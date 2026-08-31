import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

export function networkErrorCode(error) {
  let current = error;
  for (let i = 0; i < 6 && current; i += 1) {
    const code = String(current.code ?? current.name ?? "").trim();
    if (code && code !== "TypeError" && code !== "Error") return code;
    current = current.cause;
  }
  return "NETWORK";
}

export function shouldFallbackToCurl(error) {
  const code = networkErrorCode(error);
  if (RETRYABLE_CODES.has(code)) return true;
  return /^(?:ERR_SSL_|UNABLE_TO_VERIFY_|CERT_|DEPTH_ZERO_)/i.test(code);
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

  const args = [
    "--silent",
    "--show-error",
    "--location",
    "--max-redirs", "5",
    "--connect-timeout", String(connectSeconds),
    "--max-time", String(totalSeconds),
    "--compressed",
    "--proto", "=https",
    "--proto-redir", "=https",
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
      throw new Error(`curl 请求失败（exit ${result.status}）${detail ? `：${detail}` : ""}`);
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
    redirect: "follow",
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

export async function fetchTextWithFallback(url, options = {}) {
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
        throw new Error(`网络请求失败：curl 与 Node fetch 均失败（curl: ${curlError.message}; node: ${networkErrorCode(nodeError)}）。`);
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
      throw new Error(`网络请求失败：Node fetch ${networkErrorCode(nodeError)}，curl 回退也失败（${curlError.message}）。`);
    }
  }
}
