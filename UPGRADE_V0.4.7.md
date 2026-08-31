# Averia V0.4.7 升级说明

V0.4.7 是 MOODYZ 网络层的稳定性修复，不修改正式数据模型。

## 修复内容

此前 V0.4.5 已能对 HTTP 408/429/500/502/503/504 自动重试，但如果请求在取得 HTTP 状态码之前失败，例如 Windows Schannel 的 TLS 握手错误、`ECONNRESET` 或连接超时，Provider 仍会立即退出。

V0.4.7 将这些瞬时网络错误也纳入统一重试：

- curl exit 5/6/7/18/28/35/52/55/56/92；
- `ECONNRESET`、`ECONNREFUSED`、`ETIMEDOUT`、`EPIPE`；
- `EAI_AGAIN`、`ENETUNREACH`、`EHOSTUNREACH`；
- Undici connect / headers / body timeout 与 socket 错误；
- TLS/SSL 握手类错误。

默认最多尝试 3 次，等待约 750ms、1500ms 后再次尝试。CLI 会打印重试原因。

## 真实问题背景

在 Windows 系统代理环境中，MOODYZ 女优页曾出现：前两次 `curl exit 35`（Schannel TLS handshake failed），第三次请求恢复为 HTTP 200。该现象属于瞬时网络链路抖动，因此不应第一次失败就终止 Provider。

## 安全边界

本版本仍保持：

- Provider 不直接写正式 CSV；
- 代理端口不写死；
- `meta.json` 不保存代理地址或凭据；
- 离线 `--file` 模式完全不发网络请求。
