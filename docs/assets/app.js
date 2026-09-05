"use strict";

/* ============================================================
 * Averia Browser —— 独立资料库页面（docs/browser.html）
 *
 * 数据来自 window.AVERIA_DATA（由 scripts/web-export.mjs 生成）。
 * 样式来自 assets/theme.css（变量/明暗）+ assets/browser.css（组件）。
 * 明暗主题切换由 assets/theme.js 统一处理（两个页面共用）。
 * ============================================================ */

const DATA = window.AVERIA_DATA;

const STATE = {
  tab: "actresses",
  actress: { q: "", status: "", cup: "", blood: "", birthplace: "", sort: "primary_name", dir: "asc" },
  work: { q: "", maker: "", label: "", series: "", genre: "", year: "", sort: "release_date", dir: "desc" },
};

const DEFAULT_DESC = new Set(["release_date", "score", "workCount", "castCount"]);

/* ---------------- 通用工具 ---------------- */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]),
  );
}
function fmtDate(d) {
  return d ? String(d).slice(0, 10) : "";
}
function threeSize(a) {
  if (a.bust_cm == null || a.waist_cm == null || a.hip_cm == null) return null;
  return `${a.bust_cm}-${a.waist_cm}-${a.hip_cm}`;
}
function threeNum(a) {
  if (a.bust_cm == null || a.waist_cm == null || a.hip_cm == null) return -1;
  return a.bust_cm * 10000 + a.waist_cm * 100 + a.hip_cm;
}
function thumb(url, ph = "\u65E0", cls = "") {
  return `<div class="thumb ${cls}"><span class="thumb-ph">${ph}</span>${
    url ? `<img src="${esc(url)}" loading="lazy" onerror="this.remove()">` : ""
  }</div>`;
}
function statusBadge(status) {
  const s = status || "unknown";
  const map = { active: ["active", "\u73B0\u5F79"], retired: ["retired", "\u5F15\u9000"], unknown: ["unknown", "\u672A\u77E5"] };
  const [cls, label] = map[s] || map.unknown;
  return `<span class="badge ${cls}">${label}</span>`;
}
function dash(v) {
  return v == null || v === "" ? '<span class="muted">\u2014</span>' : v;
}

/* ---------------- 列定义 ---------------- */
const ACTRESS_COLS = [
  { key: "#", sortable: false, render: (a, i) => i + 1 },
  { key: "avatar", sortable: false, render: (a) => thumb(a.profile_image_url, "\u65E0", "ph-avatar") },
  {
    key: "primary_name",
    label: "\u540D\u5B57",
    sortable: true,
    sortVal: (a) => a.primary_name || "",
    render: (a) =>
      `<div class="name-cell"><div><div class="name-main">${esc(a.primary_name)}</div>${
        a.name_en ? `<div class="name-sub">${esc(a.name_en)}</div>` : ""
      }</div></div>`,
  },
  { key: "name_ja", label: "\u65E5\u6587\u540D", sortable: true, cls: "hide-sm", sortVal: (a) => a.name_ja || "", render: (a) => dash(a.name_ja) },
  { key: "height_cm", label: "\u8EAB\u9AD8", sortable: true, num: true, sortVal: (a) => a.height_cm ?? -1, render: (a) => (a.height_cm ? a.height_cm + " cm" : dash(null)) },
  { key: "three", label: "\u4E09\u56F4", sortable: true, num: true, cls: "hide-sm", sortVal: threeNum, render: (a) => dash(threeSize(a)) },
  { key: "cup", label: "\u7F69\u676F", sortable: true, cls: "hide-sm", sortVal: (a) => a.cup || "", render: (a) => dash(a.cup) },
  { key: "blood_type", label: "\u8840\u578B", sortable: true, cls: "hide-sm", sortVal: (a) => a.blood_type || "", render: (a) => dash(a.blood_type) },
  { key: "birthplace", label: "\u51FA\u751F\u5730", sortable: true, cls: "hide-sm", sortVal: (a) => a.birthplace || "", render: (a) => dash(a.birthplace) },
  { key: "status", label: "\u72B6\u6001", sortable: true, sortVal: (a) => a.status || "unknown", render: (a) => statusBadge(a.status) },
  { key: "workCount", label: "\u4F5C\u54C1", sortable: true, num: true, sortVal: (a) => (a.works || []).length, render: (a) => (a.works || []).length },
];

const WORK_COLS = [
  { key: "#", sortable: false, render: (w, i) => i + 1 },
  { key: "cover", sortable: false, render: (w) => thumb(w.thumb_url || w.cover_url, "\u65E0") },
  {
    key: "primary_code",
    label: "\u756A\u53F7",
    sortable: true,
    sortVal: (w) => w.primary_code || "",
    render: (w) => `<span style="color:var(--accent)">${esc(w.primary_code)}</span>`,
  },
  {
    key: "title",
    label: "\u6807\u9898",
    sortable: true,
    sortVal: (w) => w.title || "",
    render: (w) =>
      `<div class="name-main">${esc(w.title)}</div>${w.title_ja ? `<div class="name-sub">${esc(w.title_ja)}</div>` : ""}`,
  },
  { key: "release_date", label: "\u53D1\u884C", sortable: true, num: true, cls: "hide-sm", sortVal: (w) => w.release_date || "", render: (w) => dash(fmtDate(w.release_date)) },
  { key: "maker_name", label: "\u5382\u5546", sortable: true, cls: "hide-sm", sortVal: (w) => w.maker_name || "", render: (w) => dash(w.maker_name) },
  { key: "series_name", label: "\u7CFB\u5217", sortable: true, cls: "hide-sm", sortVal: (w) => w.series_name || "", render: (w) => dash(w.series_name) },
  { key: "castCount", label: "\u6F14\u5458", sortable: true, num: true, sortVal: (w) => (w.cast || []).length, render: (w) => (w.cast || []).length },
  { key: "score", label: "\u8BC4\u5206", sortable: true, num: true, cls: "hide-sm", sortVal: (w) => w.score || 0, render: (w) => dash(w.score) },
];

/* ---------------- 筛选 / 排序 ---------------- */
function distinct(arr, fn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const v = fn(x);
    if (v != null && v !== "" && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out.sort();
}

function filterActresses() {
  const f = STATE.actress;
  const q = f.q.trim().toLowerCase();
  let rows = DATA.actresses.filter((a) => {
    if (q) {
      const hay = [a.primary_name, a.name_ja, a.name_en, a.kana, ...(a.aliases || []).map((x) => x.alias)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.status && (a.status || "unknown") !== f.status) return false;
    if (f.cup && (a.cup || "") !== f.cup) return false;
    if (f.blood && (a.blood_type || "") !== f.blood) return false;
    if (f.birthplace && (a.birthplace || "") !== f.birthplace) return false;
    return true;
  });
  return sortRows(rows, ACTRESS_COLS, f);
}

function filterWorks() {
  const f = STATE.work;
  const q = f.q.trim().toLowerCase();
  let rows = DATA.works.filter((w) => {
    if (q) {
      const hay = [w.primary_code, w.title, w.title_ja, ...(w.cast || []).map((c) => c.primary_name)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.maker && w.maker_name !== f.maker) return false;
    if (f.label && w.label_name !== f.label) return false;
    if (f.series && w.series_name !== f.series) return false;
    if (f.genre && !(w.genres || []).some((g) => g.name === f.genre)) return false;
    if (f.year && (w.release_date || "").slice(0, 4) !== f.year) return false;
    return true;
  });
  return sortRows(rows, WORK_COLS, f);
}

function sortRows(rows, cols, f) {
  const col = cols.find((c) => c.key === f.sort);
  if (!col || !col.sortVal) return rows;
  const dir = f.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const va = col.sortVal(a);
    const vb = col.sortVal(b);
    if (col.num) return (Number(va) - Number(vb)) * dir;
    return String(va).localeCompare(String(vb), "ja") * dir;
  });
}

/* ---------------- 渲染：工具栏 ---------------- */
function buildSelect(name, label, values, current) {
  const opts = [`<option value="">\u5168\u90E8${label}</option>`].concat(
    values.map((v) => `<option value="${esc(v)}"${v === current ? " selected" : ""}>${esc(v)}</option>`),
  );
  return `<select data-filter="${name}">${opts.join("")}</select>`;
}

function renderActressToolbar() {
  const cups = distinct(DATA.actresses, (a) => a.cup);
  const bloods = distinct(DATA.actresses, (a) => a.blood_type);
  const places = distinct(DATA.actresses, (a) => a.birthplace);
  const f = STATE.actress;
  return `<div class="toolbar">
    <div class="search"><input type="text" data-filter="q" placeholder="\u641C\u7D22\u540D\u5B57 / \u522B\u540D\uFF08\u4E2D\u65E5\u82F1\uFF09" value="${esc(f.q)}"></div>
    ${buildSelect("status", "\u72B6\u6001", ["active", "retired", "unknown"], f.status)}
    ${buildSelect("cup", "\u7F69\u676F", cups, f.cup)}
    ${buildSelect("blood", "\u8840\u578B", bloods, f.blood)}
    ${buildSelect("birthplace", "\u51FA\u751F\u5730", places, f.birthplace)}
  </div>`;
}

function renderWorkToolbar() {
  const makers = distinct(DATA.works, (w) => w.maker_name);
  const labels = distinct(DATA.works, (w) => w.label_name);
  const series = distinct(DATA.works, (w) => w.series_name);
  const genres = distinct(DATA.genres, (g) => g.name);
  const years = distinct(DATA.works, (w) => (w.release_date || "").slice(0, 4));
  const f = STATE.work;
  return `<div class="toolbar">
    <div class="search"><input type="text" data-filter="q" placeholder="\u641C\u7D22\u756A\u53F7 / \u6807\u9898 / \u6F14\u5458" value="${esc(f.q)}"></div>
    ${buildSelect("maker", "\u5382\u5546", makers, f.maker)}
    ${buildSelect("label", "\u538C\u724C", labels, f.label)}
    ${buildSelect("series", "\u7CFB\u5217", series, f.series)}
    ${buildSelect("genre", "\u5206\u7C7B", genres, f.genre)}
    ${buildSelect("year", "\u5E74\u4EFD", years, f.year)}
  </div>`;
}

/* ---------------- 渲染：表格 ---------------- */
function renderTable(rows, cols, tab) {
  const head =
    `<thead><tr>` +
    cols
      .map((c) => {
        if (!c.sortable) return `<th class="${c.cls || ""}">${c.label || ""}</th>`;
        const arrow = STATE[tab].sort === c.key ? `<span class="arrow">${STATE[tab].dir === "asc" ? "\u25B2" : "\u25BC"}</span>` : "";
        return `<th class="sortable ${c.cls || ""}" data-sort="${c.key}">${c.label || ""}${arrow}</th>`;
      })
      .join("") +
    `</tr></thead>`;

  const body = rows.length
    ? `<tbody>${rows
        .map(
          (r, i) =>
            `<tr data-id="${r.id}">${cols.map((c) => `<td class="${c.cls || ""} ${c.num ? "num" : ""}">${c.render(r, i)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>`
    : `<tbody><tr><td class="empty" colspan="${cols.length}">\u6CA1\u6709\u5339\u914D\u7684\u7ED3\u679C</td></tr></tbody>`;

  return `<div class="table-wrap"><table>${head}${body}</table></div>`;
}

/* ---------------- 视图入口 ---------------- */
function renderActresses() {
  const rows = filterActresses();
  const app = document.getElementById("app");
  app.innerHTML = renderActressToolbar() + `<div class="count">${rows.length} \u4F4D\u6F14\u5458</div>` + renderTable(rows, ACTRESS_COLS, "actress");
  wireToolbar("actress");
}

function renderWorks() {
  const rows = filterWorks();
  const app = document.getElementById("app");
  app.innerHTML = renderWorkToolbar() + `<div class="count">${rows.length} \u90E8\u4F5C\u54C1</div>` + renderTable(rows, WORK_COLS, "work");
  wireToolbar("work");
}

function wireToolbar(tab) {
  const app = document.getElementById("app");
  app.querySelectorAll("[data-filter]").forEach((el) => {
    const key = el.dataset.filter;
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, (e) => {
      STATE[tab][key] = e.target.value;
      tab === "actress" ? renderActresses() : renderWorks();
    });
  });
  app.querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      const f = STATE[tab];
      if (f.sort === key) f.dir = f.dir === "asc" ? "desc" : "asc";
      else {
        f.sort = key;
        f.dir = DEFAULT_DESC.has(key) ? "desc" : "asc";
      }
      tab === "actress" ? renderActresses() : renderWorks();
    });
  });
  app.querySelectorAll("tbody tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      const id = tr.dataset.id;
      tab === "actress" ? openActress(id) : openWork(id);
    });
  });
}

/* ---------------- 详情弹窗 ---------------- */
function openModal(html) {
  // 如果还没有 modal 容器，创建一个
  let modal = document.getElementById("modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal";
    modal.className = "modal-backdrop";
    modal.hidden = true;
    modal.innerHTML = '<div class="modal"><div class="modal-head" id="modalHead"></div><div class="modal-body" id="modalBody"></div></div>';
    document.body.appendChild(modal);
  }
  document.getElementById("modalBody").innerHTML = html;
  modal.hidden = false;
}
function closeModal() {
  const modal = document.getElementById("modal");
  if (modal) modal.hidden = true;
}

function infoItem(k, v) {
  return `<div class="info-item"><div class="k">${k}</div><div class="v">${v}</div></div>`;
}

function openActress(id) {
  const a = DATA.actresses.find((x) => x.id === id);
  if (!a) return;
  const works = a.works || [];
  const aliases = (a.aliases || []).map((x) => `<span>${esc(x.alias)}</span>`).join("");

  const info = [
    infoItem("\u751F\u65E5", dash(a.birth_date ? fmtDate(a.birth_date) : null)),
    infoItem("\u51FA\u9053", dash(a.debut_date ? fmtDate(a.debut_date) : null)),
    infoItem("\u5F15\u9000", dash(a.retirement_date ? fmtDate(a.retirement_date) : null)),
    infoItem("\u8EAB\u9AD8", a.height_cm ? a.height_cm + " cm" : dash(null)),
    infoItem("\u4E09\u56F4", dash(threeSize(a))),
    infoItem("\u7F69\u676F", dash(a.cup)),
    infoItem("\u8840\u578B", dash(a.blood_type)),
    infoItem("\u51FA\u751F\u5730", dash(a.birthplace)),
    infoItem("\u72B6\u6001", statusBadge(a.status)),
  ].join("");

  const film =
    works.length
      ? `<div class="film-grid">${works
          .map(
            (w) => `<div class="film-card" data-open="work" data-id="${w.id}">
              ${thumb(w.thumb_url, "\u65E0")}
              <div class="cap"><div class="code">${esc(w.primary_code)}</div><div class="t">${esc(w.title)}</div></div>
            </div>`,
          )
          .join("")}</div>`
      : `<div class="empty">\u6682\u65E0\u51FA\u6F14\u4F5C\u54C1\u8BB0\u5F55</div>`;

  const html = `
    <div class="modal-head">
      ${thumb(a.profile_image_url, "\u65E0", "avatar")}
      <div class="modal-title">
        <h2>${esc(a.primary_name)}</h2>
        <div class="romaji">${[a.name_ja, a.name_en, a.kana].filter(Boolean).map(esc).join(" \u00B7 ") || "\u2014"}</div>
      </div>
      <button class="close" data-close="true">\u00D7</button>
    </div>
    <div class="modal-body">
      <div class="section-title">\u57FA\u672C\u4FE1\u606F</div>
      <div class="info-grid">${info}</div>
      ${aliases ? `<div class="section-title">\u522B\u540D</div><div class="alias-list">${aliases}</div>` : ""}
      <div class="section-title">\u51FA\u6F14\u4F5C\u54C1\uFF08${works.length}\uFF09</div>
      ${film}
    </div>`;
  openModal(html);
}

function openWork(id) {
  const w = DATA.works.find((x) => x.id === id);
  if (!w) return;
  const cast = (w.cast || [])
    .map(
      (c) =>
        `<div class="cast-chip" data-open="actress" data-id="${c.actress_id}">${thumb(null, "\u65E0", "sm ph-avatar")}<span>${esc(c.primary_name)}</span></div>`,
    )
    .join("");
  const genres = (w.genres || []).map((g) => `<span class="tag">${esc(g.name)}</span>`).join("");
  const directors = (w.directors || []).map((d) => esc(d.name)).join("\u3001");
  const codes = (w.codes || []).map((c) => c.code).join("\u3001");

  const html = `
    <div class="modal-head">
      ${thumb(w.cover_url || w.thumb_url, "\u65E0")}
      <div class="modal-title">
        <h2>${esc(w.primary_code)}</h2>
        <div class="romaji">${esc(w.title)}</div>
        ${w.title_ja ? `<div class="romaji">${esc(w.title_ja)}</div>` : ""}
      </div>
      <button class="close" data-close="true">\u00D7</button>
    </div>
    <div class="modal-body">
      <div class="section-title">\u57FA\u672C\u4FE1\u606F</div>
      <div class="meta-row">
        <span>\u53D1\u884C：<b>${dash(fmtDate(w.release_date))}</b></span>
        <span>\u65F6\u957F：<b>${w.duration_min ? w.duration_min + " \u5206" : "\u2014"}</b></span>
        <span>\u5382\u5546：<b>${dash(w.maker_name)}</b></span>
        <span>\u538C\u724C：<b>${dash(w.label_name)}</b></span>
        <span>\u7CFB\u5217：<b>${dash(w.series_name)}</b></span>
        <span>\u8BC4\u5206：<b>${w.score ? w.score : "\u2014"}</b></span>
      </div>
      ${codes && w.codes.length > 1 ? `<div class="meta-row" style="margin-top:8px">\u5176\u4ED6\u756A\u53F7：<b>${esc(codes)}</b></div>` : ""}
      ${cast ? `<div class="section-title">\u51FA\u6F14\uFF08${w.cast.length}\uFF09</div><div class="cast-list">${cast}</div>` : `<div class="section-title">\u51FA\u6F14</div><div class="empty">\u6682\u65E0\u6F14\u5458\u8BB0\u5F55</div>`}
      ${genres ? `<div class="section-title">\u5206\u7C7B</div><div>${genres}</div>` : ""}
      ${directors ? `<div class="section-title>\u5BFC\u6F14</div><div class="desc">${directors}</div>` : ""}
      ${w.description ? `<div class="section-title">\u7B80\u4ECB</div><div class="desc">${esc(w.description)}</div>` : ""}
    </div>`;
  openModal(html);
}

/* ---------------- 启动 ---------------- */
function setTab(tab) {
  STATE.tab = tab;
  document.querySelectorAll("#tabs .browser-tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  tab === "actresses" ? renderActresses() : renderWorks();
}

function init() {
  if (!DATA || !DATA.meta) {
    document.getElementById("app").innerHTML = `<div class="empty">\u6570\u636E\u672A\u52A0\u8F7D\uFF1A\u8BF7\u5148\u8FD0\u884C <code>pnpm web:export</code> \u751F\u6210 data</div>`;
    return;
  }
  const c = DATA.meta.counts;
  document.getElementById("metaLine").textContent = `\u6F14\u5458 ${c.actresses} \u00B7 \u4F5C\u54C1 ${c.works} \u00B7 \u5206\u7C7B ${c.genres}`;
  document.querySelectorAll("#tabs .browser-tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  // 弹窗事件委托（动态创建的 modal）
  document.addEventListener("click", (e) => {
    const modal = document.getElementById("modal");
    if (modal) {
      if (e.target === modal || e.target.closest("[data-close]")) closeModal();
      const t = e.target.closest("[data-open]");
      if (t) {
        const kind = t.dataset.open;
        const id = t.dataset.id;
        if (kind === "work") openWork(id);
        else if (kind === "actress") openActress(id);
      }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  setTab("actresses");
}

init();
