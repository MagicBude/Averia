import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "AVERIA_TRANSIENT_NETWORK",
]);

// curl/libcurl 常见的瞬时网络错误。Windows Schannel 在代理链路抖动时
// 经常返回 35（TLS handshake），用户真实环境已验证重试后可以恢复。
const RETRYABLE_CURL_EXITS = new Set([5, 6, 7, 18, 28, 35, 52, 55, 56, 92]);

export const RETRYABLE_HTTP_STATUS = new Set([408, 429, 500, 502, 503, 504]);

export function shouldRetryHttpStatus(status) {
  return RETRYABLE_HTTP_STATUS.has(Number(status));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}


export function networkErrorCode(error) {
  let current = error;
  for (let i = 0; i < 6 && current; i += 1) {
    const code = String(current.code ?? current.name ?? "").trim();
    if (code && code !== "TypeError" && code !== "Error") return code;
    current = current.cause;
  }
  return "NETWORK";
}

export function shouldRetryNetworkError(error) {
  let current = error;
  for (let i = 0; i < 8 && current; i += 1) {
    const code = String(current.code ?? current.name ?? "").trim();
    if (RETRYABLE_CODES.has(code)) return true;
    const curlMatch = /^CURL_EXIT_(\d+)$/.exec(code);
    if (curlMatch && RETRYABLE_CURL_EXITS.has(Number(curlMatch[1]))) return true;
    if (/^(?:ERR_SSL_|UNABLE_TO_VERIFY_|CERT_|DEPTH_ZERO_)/i.test(code)) return true;
    current = current.cause;
  }

  const message = String(error?.message ?? "");
  const exitMatch = /curl 请求失败（exit (\d+)）/.exec(message);
  if (exitMatch && RETRYABLE_CURL_EXITS.has(Number(exitMatch[1]))) return true;
  return /ECONNRESET|ETIMEDOUT|CONNECT_TIMEOUT|TLS|SSL\/TLS|handshake/i.test(message);
}

export function shouldFallbackToCurl(error) {
  return shouldRetryNetworkError(error);
}

function curlCommand(platform = process.platform) {
  return platform === "win32" ? "curl.exe" : "curl";
}

function seconds(ms, fallback) {
  const value = Number(ms);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.max(1, Math.ceil(value / 1000));
}

export function fetchTextViaCurl(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  const connectSeconds = seconds(Math.min(timeoutMs, 15000), 15);
  const totalSeconds = seconds(timeoutMs, 15);
  const tmpDir = fs.mkdtempSync(path.join(options.tmpRoot ?? os.tmpdir(), "averia-curl-"));
  const bodyPath = path.join(tmpDir, "body.txt");
  const headers = options.headers ?? {};

  const followRedirects = options.followRedirects !== false;
  const args = [
    "--silent",
    "--show-error",
    ...(followRedirects ? ["--location", "--max-redirs", "5"] : []),
    "--connect-timeout", String(connectSeconds),
    "--max-time", String(totalSeconds),
    "--compressed",
    "--proto", "=https",
    ...(followRedirects ? ["--proto-redir", "=https"] : []),
    "--output", bodyPath,
    "--write-out", "%{http_code}\n%{url_effective}\n%{content_type}\n",
  ];

  const userAgent = options.userAgent || headers["user-agent"] || headers["User-Agent"];
  if (userAgent) args.push("--user-agent", String(userAgent));

  for (const [name, value] of Object.entries(headers)) {
    if (!value || name.toLowerCase() === "user-agent") continue;
    args.push("--header", `${name}: ${value}`);
  }

  if (options.proxyUrl) args.push("--proxy", String(options.proxyUrl));

  // 某些公开站点会通过普通 Set-Cookie + Redirect 维护一次会话状态。
  // cookieJar 由调用方显式提供，Averia 不会把 Cookie 内容写入日志或元数据。
  if (options.cookieJar) {
    const cookieJar = String(options.cookieJar);
    if (!fs.existsSync(cookieJar)) fs.writeFileSync(cookieJar, "", "utf8");
    args.push("--cookie", cookieJar, "--cookie-jar", cookieJar);
  }
  args.push(String(url));

  try {
    const result = (options.spawn ?? spawnSync)(curlCommand(options.platform), args, {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    });

    if (result.error) {
      const code = result.error.code || result.error.name || "CURL_UNAVAILABLE";
      throw new Error(`curl 启动失败（${code}）`);
    }
    if ((result.status ?? 1) !== 0) {
      const detail = String(result.stderr ?? "").trim();
      const error = new Error(`curl 请求失败（exit ${result.status}）${detail ? `：${detail}` : ""}`);
      error.code = `CURL_EXIT_${result.status}`;
      throw error;
    }

    const lines = String(result.stdout ?? "").split(/\r?\n/);
    const status = Number.parseInt(lines[0] || "0", 10) || 0;
    const finalUrl = lines[1] || String(url);
    const contentType = lines[2] || "";
    const text = fs.readFileSync(bodyPath, "utf8");
    return { text, finalUrl, status, contentType, transport: "curl" };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function fetchTextViaNode(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 15000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    redirect: options.followRedirects === false ? "manual" : "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: options.headers ?? {},
  });
  return {
    text: await response.text(),
    finalUrl: response.url || String(url),
    status: response.status,
    contentType: response.headers?.get?.("content-type") ?? "",
    transport: "node-fetch",
  };
}

async function fetchTextOnceWithFallback(url, options = {}) {
  const mode = String(options.transport ?? "auto").toLowerCase();
  if (!new Set(["auto", "node", "curl"]).has(mode)) {
    throw new Error(`未知网络传输模式：${mode}；仅支持 auto / node / curl。`);
  }

  const curlImpl = options.curlImpl ?? fetchTextViaCurl;
  const nodeImpl = options.nodeImpl ?? fetchTextViaNode;
  const curlOptions = {
    ...options,
    userAgent: options.userAgent || options.headers?.["user-agent"],
  };

  if (mode === "curl") return curlImpl(url, curlOptions);
  if (mode === "node") return nodeImpl(url, options);

  // 在 Windows + HTTP 代理环境中，部分日文官方站会在 Node/Undici TLS
  // 握手阶段主动断开，而系统 curl 可以正常访问。该组合优先 curl，避免
  // 每次先等待 Node 超时；其他环境仍然优先 Node，再按错误类型回退 curl。
  if (options.preferCurl) {
    try {
      return await curlImpl(url, curlOptions);
    } catch (curlError) {
      try {
        const result = await nodeImpl(url, options);
        return { ...result, fallbackFrom: `curl:${networkErrorCode(curlError)}` };
      } catch (nodeError) {
        const error = new Error(`网络请求失败：curl 与 Node fetch 均失败（curl: ${curlError.message}; node: ${networkErrorCode(nodeError)}）。`);
        if (shouldRetryNetworkError(curlError) || shouldRetryNetworkError(nodeError)) error.code = "AVERIA_TRANSIENT_NETWORK";
        error.cause = nodeError;
        error.curlError = curlError;
        throw error;
      }
    }
  }

  try {
    return await nodeImpl(url, options);
  } catch (nodeError) {
    if (!shouldFallbackToCurl(nodeError)) throw nodeError;
    try {
      const result = await curlImpl(url, curlOptions);
      return { ...result, fallbackFrom: `node-fetch:${networkErrorCode(nodeError)}` };
    } catch (curlError) {
      const error = new Error(`网络请求失败：Node fetch ${networkErrorCode(nodeError)}，curl 回退也失败（${curlError.message}）。`);
      if (shouldRetryNetworkError(nodeError) || shouldRetryNetworkError(curlError)) error.code = "AVERIA_TRANSIENT_NETWORK";
      error.cause = nodeError;
      error.curlError = curlError;
      throw error;
    }
  }
}

export async function fetchTextWithFallback(url, options = {}) {
  const maxAttemptsRaw = Number(options.maxAttempts ?? 3);
  const maxAttempts = Number.isFinite(maxAttemptsRaw) ? Math.min(6, Math.max(1, Math.trunc(maxAttemptsRaw))) : 3;
  const baseDelayRaw = Number(options.retryDelayMs ?? 750);
  const baseDelayMs = Number.isFinite(baseDelayRaw) ? Math.max(0, baseDelayRaw) : 750;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  let lastResult;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let result;
    try {
      result = await fetchTextOnceWithFallback(url, options);
      lastResult = result;
    } catch (error) {
      error.attempts = attempt;
      if (!shouldRetryNetworkError(error) || attempt >= maxAttempts) throw error;

      const delayMs = Math.round(baseDelayMs * (2 ** (attempt - 1)));
      options.onRetry?.({
        attempt,
        nextAttempt: attempt + 1,
        maxAttempts,
        kind: "network",
        code: networkErrorCode(error),
        message: error.message,
        delayMs,
      });
      if (delayMs > 0) await sleepImpl(delayMs);
      continue;
    }

    if (!shouldRetryHttpStatus(result.status) || attempt >= maxAttempts) {
      return { ...result, attempts: attempt };
    }

    const delayMs = Math.round(baseDelayMs * (2 ** (attempt - 1)));
    options.onRetry?.({
      attempt,
      nextAttempt: attempt + 1,
      maxAttempts,
      kind: "http",
      status: result.status,
      transport: result.transport,
      delayMs,
    });
    if (delayMs > 0) await sleepImpl(delayMs);
  }

  return { ...lastResult, attempts: maxAttempts };
}

