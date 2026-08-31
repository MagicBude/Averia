# Averia V0.6.1 升级说明

V0.6.1 根据第一次真实 DMM Rental 在线 Probe 修复年龄确认页处理。

## 真实问题

直接请求公开 Rental 详情页时，DMM 可能先返回：

```text
<title>年齢認証 - FANZA</title>
```

页面自身提供：

```text
/age_check/=/declared=yes/?rurl=<原详情页>
```

V0.6.0 会把年龄确认页当成非 Rental 页面并停止。

## V0.6.1 行为

Averia 不会替用户默认声明年龄。

首次命中年龄确认页时，如果没有 `--adult-confirmed`：

```bash
pnpm provider:dmm-rental -- --cid 4ipzz698 --code IPZZ-698
```

Provider 会停止并明确提示。

确认本人已满 18 岁后，可以显式运行：

```bash
pnpm provider:dmm-rental -- \
  --cid 4ipzz698 \
  --code IPZZ-698 \
  --adult-confirmed
```

流程为：

```text
Rental 详情 URL
  ↓
年龄确认页
  ↓  用户显式 --adult-confirmed
DMM declared=yes URL
  ↓  临时 curl Cookie Jar
DMM 自己重定向
  ↓
原 Rental 详情页
  ↓
Parser → canonical.json
```

Cookie Jar 位于系统临时目录，流程结束立即删除；不会保存 Cookie 内容、端口或凭据。

如果声明后仍然不是原详情页，Provider 会停止，不尝试绕过验证码、登录、地区限制或付费访问控制。

## 额外输出

成功经过年龄确认时，Provider 会保留：

```text
raw.html       最终作品详情页
age-gate.html  首次年龄确认页
meta.json      仅记录 age_gate_detected / age_gate_declared 布尔状态
```

## 测试

V0.6.1 新增：

- 年龄确认页识别；
- `declared=yes` 链接与 `rurl` 安全校验；
- 未明确确认年龄时不自动继续；
- 显式确认后使用临时 Cookie Jar；
- `--transport node` 不会偷偷切换成 curl 会话；
- curl Cookie Jar 参数回归测试。
