"use client";

import { useEffect, useRef, useState } from "react";

import { MoonIcon, ShieldIcon, SunIcon } from "./icons";

type Theme = "light" | "dark";
type ContentMode = "safe" | "complete";

const THEME_KEY = "averia:theme";
const MODE_SESSION_KEY = "averia:content-mode";
const MODE_DEVICE_KEY = "averia:content-mode:remembered";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

export function PreferenceControls() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [mode, setMode] = useState<ContentMode>("safe");
  const [ready, setReady] = useState(false);
  const [adultConfirmed, setAdultConfirmed] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  useEffect(() => {
    // 延迟到浏览器下一帧读取设备偏好，保持服务端首屏稳定且不制造级联渲染。
    const frame = requestAnimationFrame(() => {
      const storedTheme = localStorage.getItem(THEME_KEY) as Theme | null;
      const preferredTheme: Theme =
        storedTheme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const storedMode = (localStorage.getItem(MODE_DEVICE_KEY) ??
        sessionStorage.getItem(MODE_SESSION_KEY)) as ContentMode | null;
      setTheme(preferredTheme);
      setMode(storedMode === "complete" ? "complete" : "safe");
      applyTheme(preferredTheme);
      document.documentElement.dataset.contentMode =
        storedMode === "complete" ? "complete" : "safe";
      setReady(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  function applyMode(next: ContentMode) {
    setMode(next);
    sessionStorage.setItem(MODE_SESSION_KEY, next);
    document.documentElement.dataset.contentMode = next;
  }

  function toggleMode() {
    if (mode === "safe") {
      dialogRef.current?.showModal();
      return;
    }

    localStorage.removeItem(MODE_DEVICE_KEY);
    applyMode("safe");
  }

  function closeConfirmation() {
    dialogRef.current?.close();
    setAdultConfirmed(false);
    setRememberDevice(false);
  }

  function confirmCompleteMode() {
    if (!adultConfirmed) return;

    if (rememberDevice) localStorage.setItem(MODE_DEVICE_KEY, "complete");
    else localStorage.removeItem(MODE_DEVICE_KEY);
    applyMode("complete");
    closeConfirmation();
  }

  return (
    <div className="preference-controls" aria-busy={!ready}>
      <button
        className="mode-button"
        type="button"
        onClick={toggleMode}
        aria-pressed={mode === "complete"}
        aria-label={mode === "safe" ? "切换至完整模式" : "切换至安全模式"}
      >
        <ShieldIcon />
        <span>{mode === "safe" ? "安全模式" : "完整模式"}</span>
      </button>
      <button
        className="icon-button"
        type="button"
        onClick={toggleTheme}
        aria-label={theme === "light" ? "切换至深色主题" : "切换至浅色主题"}
      >
        {theme === "light" ? <MoonIcon /> : <SunIcon />}
      </button>
      <dialog
        className="mode-dialog"
        ref={dialogRef}
        aria-labelledby="mode-dialog-title"
        onCancel={closeConfirmation}
      >
        <form method="dialog" onSubmit={(event) => event.preventDefault()}>
          <span className="section-number">CONTENT MODE</span>
          <h2 id="mode-dialog-title">进入完整模式</h2>
          <p>完整模式可能显示成人封面、剧照与完整描述。只有来源与权利状态允许的媒体才会加载。</p>
          <label className="mode-check">
            <input
              type="checkbox"
              checked={adultConfirmed}
              onChange={(event) => setAdultConfirmed(event.target.checked)}
            />
            <span>我已成年，并希望查看完整模式内容</span>
          </label>
          <label className="mode-check mode-remember">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => setRememberDevice(event.target.checked)}
            />
            <span>在此设备记住；否则关闭浏览器会话后恢复安全模式</span>
          </label>
          <div className="mode-dialog-actions">
            <button type="button" onClick={closeConfirmation}>
              保持安全模式
            </button>
            <button type="button" disabled={!adultConfirmed} onClick={confirmCompleteMode}>
              确认进入
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
