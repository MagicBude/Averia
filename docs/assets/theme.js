"use strict";

/* ============================================================
 * Averia —— 明暗主题切换（落地页与资料库页共用）
 *
 * 读取顺序：localStorage 记忆 > 系统偏好；默认浅色。
 * 写入 <html data-theme>，并由 theme.css 的变量驱动整站配色。
 * ============================================================ */

(function () {
  var root = document.documentElement;
  var toggle = document.getElementById("themeToggle");
  var meta = document.getElementById("themeColor");
  var key = "averia-theme";

  var stored = localStorage.getItem(key);
  var prefersDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  var theme = stored || (prefersDark ? "dark" : "light");

  function apply(t) {
    root.setAttribute("data-theme", t);
    if (meta) meta.content = t === "dark" ? "#0f1419" : "#f7f8fa";
    if (toggle) {
      toggle.innerHTML =
        t === "dark"
          ? '<span class="icon">\u2600\uFE0F</span> 浅色'
          : '<span class="icon">\uD83C\uDF19</span> 深色';
    }
  }

  apply(theme);

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(key, next);
      apply(next);
    });
  }
})();
