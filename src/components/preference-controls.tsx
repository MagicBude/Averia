"use client";

import { useEffect, useState } from "react";

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
  const [theme, setTheme] = useState<Theme>("light");
  const [mode, setMode] = useState<ContentMode>("safe");
  const [ready, setReady] = useState(false);

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

  function toggleMode() {
    const next = mode === "safe" ? "complete" : "safe";
    setMode(next);
    sessionStorage.setItem(MODE_SESSION_KEY, next);
    document.documentElement.dataset.contentMode = next;
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
    </div>
  );
}
