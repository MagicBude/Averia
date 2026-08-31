import { execFileSync, spawnSync } from "node:child_process";

function firstNonEmpty(...values) {
  return values.map((v) => String(v ?? "").trim()).find(Boolean) ?? "";
}

export function normalizeProxyUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  const parsed = new URL(withScheme);
  if (!new Set(["http:", "https:"]).has(parsed.protocol)) {
    throw new Error(`当前只支持 HTTP/HTTPS 代理：${parsed.protocol}`);
  }
  return parsed.href;
}

export function redactProxyUrl(value) {
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if (parsed.username || parsed.password) {
      parsed.username = "***";
      parsed.password = "***";
    }
    return parsed.href;
  } catch {
    return "<已配置代理>";
  }
}

export function parseWindowsProxyServer(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (!raw.includes("=")) {
    const proxy = normalizeProxyUrl(raw);
    return { httpProxy: proxy, httpsProxy: proxy };
  }

  const entries = {};
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.split("=");
    if (!key || !rest.length) continue;
    entries[key.trim().toLowerCase()] = rest.join("=").trim();
  }

  const httpRaw = firstNonEmpty(entries.http, entries.https);
  const httpsRaw = firstNonEmpty(entries.https, entries.http);
  if (!httpRaw && !httpsRaw) return null;
  return {
    httpProxy: httpRaw ? normalizeProxyUrl(httpRaw) : "",
    httpsProxy: httpsRaw ? normalizeProxyUrl(httpsRaw) : "",
  };
}

function queryRegistryValue(name, exec = execFileSync) {
  try {
    return exec(
      "reg.exe",
      ["query", "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings", "/v", name],
      { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] },
    );
  } catch {
    return "";
  }
}

function registryData(output, name) {
  const pattern = new RegExp(`^\\s*${name}\\s+REG_[A-Z_]+\\s+(.+?)\\s*$`, "mi");
  return pattern.exec(String(output ?? ""))?.[1]?.trim() ?? "";
}

export function readWindowsSystemProxy({ exec = execFileSync } = {}) {
  const enabledOutput = queryRegistryValue("ProxyEnable", exec);
  const enabledRaw = registryData(enabledOutput, "ProxyEnable");
  const enabled = /^(?:0x)?1$/i.test(enabledRaw);
  if (!enabled) return null;

  const serverOutput = queryRegistryValue("ProxyServer", exec);
  const serverRaw = registryData(serverOutput, "ProxyServer");
  const parsed = parseWindowsProxyServer(serverRaw);
  if (!parsed) return null;
  return { ...parsed, raw: serverRaw };
}

function envProxy(env = process.env) {
  const httpProxy = firstNonEmpty(env.http_proxy, env.HTTP_PROXY);
  const httpsProxy = firstNonEmpty(env.https_proxy, env.HTTPS_PROXY);
  if (!httpProxy && !httpsProxy) return null;
  return {
    httpProxy: httpProxy ? normalizeProxyUrl(httpProxy) : normalizeProxyUrl(httpsProxy),
    httpsProxy: httpsProxy ? normalizeProxyUrl(httpsProxy) : normalizeProxyUrl(httpProxy),
  };
}

export function resolveProxyConfig({ explicitProxy = "", env = process.env, platform = process.platform, systemProxyReader = readWindowsSystemProxy } = {}) {
  if (explicitProxy) {
    const proxy = normalizeProxyUrl(explicitProxy);
    return { mode: "cli-proxy", proxyUsed: true, httpProxy: proxy, httpsProxy: proxy };
  }

  const fromEnv = envProxy(env);
  if (fromEnv) return { mode: "env-proxy", proxyUsed: true, ...fromEnv };

  if (platform === "win32") {
    const fromSystem = systemProxyReader?.();
    if (fromSystem?.httpProxy || fromSystem?.httpsProxy) {
      return { mode: "system-proxy", proxyUsed: true, httpProxy: fromSystem.httpProxy || fromSystem.httpsProxy, httpsProxy: fromSystem.httpsProxy || fromSystem.httpProxy };
    }
  }

  return { mode: "direct", proxyUsed: false, httpProxy: "", httpsProxy: "" };
}

export function nodeSupportsEnvProxy(version = process.versions.node) {
  const [major = 0, minor = 0] = String(version).split(".").map((n) => Number.parseInt(n, 10));
  return major >= 24 || (major === 22 && minor >= 21);
}

export function buildProxyBootstrapEnv(config, env = process.env) {
  const next = { ...env };
  if (config.httpProxy) next.HTTP_PROXY = config.httpProxy;
  if (config.httpsProxy) next.HTTPS_PROXY = config.httpsProxy;
  next.NODE_USE_ENV_PROXY = "1";
  next.AVERIA_PROXY_BOOTSTRAPPED = "1";
  next.AVERIA_PROXY_MODE = config.mode;
  return next;
}

export function bootstrapProxyIfNeeded({ explicitProxy = "", argv = process.argv.slice(2), scriptPath = process.argv[1], env = process.env, platform = process.platform, systemProxyReader = readWindowsSystemProxy, spawn = spawnSync, nodeVersion = process.versions.node } = {}) {
  const config = resolveProxyConfig({ explicitProxy, env, platform, systemProxyReader });
  if (!config.proxyUsed) return { relaunched: false, config };

  if (env.AVERIA_PROXY_BOOTSTRAPPED === "1") {
    return { relaunched: false, config: { ...config, mode: env.AVERIA_PROXY_MODE || config.mode } };
  }

  // 如果进程启动时已经显式启用了环境代理，Node 的全局 fetch 已经可用，无需重启。
  if (config.mode === "env-proxy" && env.NODE_USE_ENV_PROXY === "1") {
    return { relaunched: false, config };
  }

  if (!nodeSupportsEnvProxy(nodeVersion)) {
    throw new Error(`检测到需要使用代理，但当前 Node.js ${nodeVersion} 不支持 Averia 的自动环境代理。请升级到 Node.js >= 24，或 Node.js >= 22.21。`);
  }

  const result = spawn(process.execPath, [scriptPath, ...argv], {
    stdio: "inherit",
    env: buildProxyBootstrapEnv(config, env),
    windowsHide: true,
  });
  return { relaunched: true, config, status: result.status ?? 1, error: result.error };
}

export function describeNetworkMode(config, env = process.env) {
  const mode = env.AVERIA_PROXY_MODE || config.mode;
  const label = {
    "cli-proxy": "命令行代理",
    "env-proxy": "环境变量代理",
    "system-proxy": "Windows 系统代理",
    direct: "直连",
  }[mode] ?? mode;
  const proxy = config.httpsProxy || config.httpProxy;
  return {
    mode,
    label,
    proxyUsed: Boolean(config.proxyUsed),
    displayProxy: proxy ? redactProxyUrl(proxy) : "",
  };
}
