"use strict";

/* ============================================================
 * Averia Web —— 纯静态前端（无构建步骤）
 * 数据来自 window.AVERIA_DATA（由 scripts/web-export.mjs 生成）。
 *
 * 设计优先级（按用户长期规划）：
 *   1) 演员信息库（对标 JAV_info）：演员全部信息 + 全部出演作品  ← 本期重点
 *   2) 作品信息库：所有作品元信息（后续阶段）
 * 当前已实现：演员视图（完整信息 + 作品墙）、作品视图（可浏览 + 详情）。
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
// 缩略图：加载失败自动移除，露出底层的「无」占位
function thumb(url, ph = "无", cls = "") {
  return `<div class="thumb ${cls}"><span class="thumb-ph">${ph}</span>${
    url ? `<img src="${esc(url)}" loading="lazy" onerror="this.remove()">` : ""
  }</div>`;
}
function statusBadge(status) {
  const s = status || "unknown";
  const map = { active: ["active", "现役"], retired: ["retired", "引退"], unknown: ["unknown", "未知"] };
  const [cls, label] = map[s] || map.unknown;
  return `<span class="badge ${cls}">${label}</span>`;
}
function dash(v) {
  return v == null || v === "" ? '<span class="muted">—</span>' : v;
}

/* ---------------- 列定义 ---------------- */
const ACTRESS_COLS = [
  { key: "#", sortable: false, render: (a, i) => i + 1 },
  { key: "avatar", sortable: false, render: (a) => thumb(a.profile_image_url, "无", "ph-avatar") },
  {
    key: "primary_name",
    label: "名字",
    sortable: true,
    sortVal: (a) => a.primary_name || "",
    render: (a) =>
      `<div class="name-cell"><div><div class="name-main">${esc(a.primary_name)}</div>${
        a.name_en ? `<div class="name-sub">${esc(a.name_en)}</div>` : ""
      }</div></div>`,
  },
  { key: "name_ja", label: "日文名", sortable: true, cls: "hide-sm", sortVal: (a) => a.name_ja || "", render: (a) => dash(a.name_ja) },
  { key: "height_cm", label: "身高", sortable: true, num: true, sortVal: (a) => a.height_cm ?? -1, render: (a) => (a.height_cm ? a.height_cm + " cm" : dash(null)) },
  { key: "three", label: "三围", sortable: true, num: true, cls: "hide-sm", sortVal: threeNum, render: (a) => dash(threeSize(a)) },
  { key: "cup", label: "罩杯", sortable: true, cls: "hide-sm", sortVal: (a) => a.cup || "", render: (a) => dash(a.cup) },
  { key: "blood_type", label: "血型", sortable: true, cls: "hide-sm", sortVal: (a) => a.blood_type || "", render: (a) => dash(a.blood_type) },
  { key: "birthplace", label: "出生地", sortable: true, cls: "hide-sm", sortVal: (a) => a.birthplace || "", render: (a) => dash(a.birthplace) },
  { key: "status", label: "状态", sortable: true, sortVal: (a) => a.status || "unknown", render: (a) => statusBadge(a.status) },
  { key: "workCount", label: "作品", sortable: true, num: true, sortVal: (a) => (a.works || []).length, render: (a) => (a.works || []).length },
];

const WORK_COLS = [
  { key: "#", sortable: false, render: (w, i) => i + 1 },
  { key: "cover", sortable: false, render: (w) => thumb(w.thumb_url || w.cover_url, "无") },
  {
    key: "primary_code",
    label: "番号",
    sortable: true,
    sortVal: (w) => w.primary_code || "",
    render: (w) => `<span style="color:var(--accent)">${esc(w.primary_code)}</span>`,
  },
  {
    key: "title",
    label: "标题",
    sortable: true,
    sortVal: (w) => w.title || "",
    render: (w) =>
      `<div class="name-main">${esc(w.title)}</div>${w.title_ja ? `<div class="name-sub">${esc(w.title_ja)}</div>` : ""}`,
  },
  { key: "release_date", label: "发行", sortable: true, num: true, cls: "hide-sm", sortVal: (w) => w.release_date || "", render: (w) => dash(fmtDate(w.release_date)) },
  { key: "maker_name", label: "厂商", sortable: true, cls: "hide-sm", sortVal: (w) => w.maker_name || "", render: (w) => dash(w.maker_name) },
  { key: "series_name", label: "系列", sortable: true, cls: "hide-sm", sortVal: (w) => w.series_name || "", render: (w) => dash(w.series_name) },
  { key: "castCount", label: "演员", sortable: true, num: true, sortVal: (w) => (w.cast || []).length, render: (w) => (w.cast || []).length },
  { key: "score", label: "评分", sortable: true, num: true, cls: "hide-sm", sortVal: (w) => w.score || 0, render: (w) => dash(w.score) },
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
  const opts = [`<option value="">全部${label}</option>`].concat(
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
    <div class="search"><input type="text" data-filter="q" placeholder="搜索名字 / 别名（中日英）" value="${esc(f.q)}"></div>
    ${buildSelect("status", "状态", ["active", "retired", "unknown"], f.status)}
    ${buildSelect("cup", "罩杯", cups, f.cup)}
    ${buildSelect("blood", "血型", bloods, f.blood)}
    ${buildSelect("birthplace", "出生地", places, f.birthplace)}
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
    <div class="search"><input type="text" data-filter="q" placeholder="搜索番号 / 标题 / 演员" value="${esc(f.q)}"></div>
    ${buildSelect("maker", "厂商", makers, f.maker)}
    ${buildSelect("label", "厂牌", labels, f.label)}
    ${buildSelect("series", "系列", series, f.series)}
    ${buildSelect("genre", "分类", genres, f.genre)}
    ${buildSelect("year", "年份", years, f.year)}
  </div>`;
}

/* ---------------- 渲染：表格 ---------------- */
function renderTable(rows, cols, tab) {
  const f = STATE[tab];
  const head =
    `<thead><tr>` +
    cols
      .map((c) => {
        if (!c.sortable) return `<th class="${c.cls || ""}">${c.label || ""}</th>`;
        const arrow = f.sort === c.key ? `<span class="arrow">${f.dir === "asc" ? "▲" : "▼"}</span>` : "";
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
    : `<tbody><tr><td class="empty" colspan="${cols.length}">没有匹配的结果</td></tr></tbody>`;

  return `<div class="table-wrap"><table>${head}${body}</table></div>`;
}

/* ---------------- 视图入口 ---------------- */
function renderActresses() {
  const rows = filterActresses();
  const app = document.getElementById("app");
  app.innerHTML = renderActressToolbar() + `<div class="count">${rows.length} 位演员</div>` + renderTable(rows, ACTRESS_COLS, "actress");
  wireToolbar("actress");
}

function renderWorks() {
  const rows = filterWorks();
  const app = document.getElementById("app");
  app.innerHTML = renderWorkToolbar() + `<div class="count">${rows.length} 部作品</div>` + renderTable(rows, WORK_COLS, "work");
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
  const modal = document.getElementById("modal");
  document.getElementById("modalBody").innerHTML = html;
  modal.hidden = false;
}
function closeModal() {
  document.getElementById("modal").hidden = true;
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
    infoItem("生日", dash(a.birth_date ? fmtDate(a.birth_date) : null)),
    infoItem("出道", dash(a.debut_date ? fmtDate(a.debut_date) : null)),
    infoItem("引退", dash(a.retirement_date ? fmtDate(a.retirement_date) : null)),
    infoItem("身高", a.height_cm ? a.height_cm + " cm" : dash(null)),
    infoItem("三围", dash(threeSize(a))),
    infoItem("罩杯", dash(a.cup)),
    infoItem("血型", dash(a.blood_type)),
    infoItem("出生地", dash(a.birthplace)),
    infoItem("状态", statusBadge(a.status)),
  ].join("");

  const film =
    works.length
      ? `<div class="film-grid">${works
          .map(
            (w) => `<div class="film-card" data-open="work" data-id="${w.id}">
              ${thumb(w.thumb_url, "无")}
              <div class="cap"><div class="code">${esc(w.primary_code)}</div><div class="t">${esc(w.title)}</div></div>
            </div>`,
          )
          .join("")}</div>`
      : `<div class="empty">暂无出演作品记录</div>`;

  const html = `
    <div class="modal-head">
      ${thumb(a.profile_image_url, "无", "avatar")}
      <div class="modal-title">
        <h2>${esc(a.primary_name)}</h2>
        <div class="romaji">${[a.name_ja, a.name_en, a.kana].filter(Boolean).map(esc).join(" · ") || "—"}</div>
      </div>
      <button class="close" data-close>×</button>
    </div>
    <div class="modal-body">
      <div class="section-title">基本信息</div>
      <div class="info-grid">${info}</div>
      ${aliases ? `<div class="section-title">别名</div><div class="alias-list">${aliases}</div>` : ""}
      <div class="section-title">出演作品（${works.length}）</div>
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
        `<div class="cast-chip" data-open="actress" data-id="${c.actress_id}">${thumb(null, "无", "sm ph-avatar")}<span>${esc(c.primary_name)}</span></div>`,
    )
    .join("");
  const genres = (w.genres || []).map((g) => `<span class="tag">${esc(g.name)}</span>`).join("");
  const directors = (w.directors || []).map((d) => esc(d.name)).join("、");
  const codes = (w.codes || []).map((c) => c.code).join("、");

  const html = `
    <div class="modal-head">
      ${thumb(w.cover_url || w.thumb_url, "无")}
      <div class="modal-title">
        <h2>${esc(w.primary_code)}</h2>
        <div class="romaji">${esc(w.title)}</div>
        ${w.title_ja ? `<div class="romaji">${esc(w.title_ja)}</div>` : ""}
      </div>
      <button class="close" data-close>×</button>
    </div>
    <div class="modal-body">
      <div class="section-title">基本信息</div>
      <div class="meta-row">
        <span>发行：<b>${dash(fmtDate(w.release_date))}</b></span>
        <span>时长：<b>${w.duration_min ? w.duration_min + " 分" : "—"}</b></span>
        <span>厂商：<b>${dash(w.maker_name)}</b></span>
        <span>厂牌：<b>${dash(w.label_name)}</b></span>
        <span>系列：<b>${dash(w.series_name)}</b></span>
        <span>评分：<b>${w.score ? w.score : "—"}</b></span>
      </div>
      ${codes && w.codes.length > 1 ? `<div class="meta-row" style="margin-top:8px">其他番号：<b>${esc(codes)}</b></div>` : ""}
      ${cast ? `<div class="section-title">出演（${w.cast.length}）</div><div class="cast-list">${cast}</div>` : `<div class="section-title">出演</div><div class="empty">暂无演员记录</div>`}
      ${genres ? `<div class="section-title">分类</div><div>${genres}</div>` : ""}
      ${directors ? `<div class="section-title">导演</div><div class="desc">${directors}</div>` : ""}
      ${w.description ? `<div class="section-title">简介</div><div class="desc">${esc(w.description)}</div>` : ""}
    </div>`;
  openModal(html);
}

/* ---------------- 启动 ---------------- */
function setTab(tab) {
  STATE.tab = tab;
  document.querySelectorAll("#tabs .tab").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === tab));
  tab === "actresses" ? renderActresses() : renderWorks();
}

function init() {
  if (!DATA || !DATA.meta) {
    document.getElementById("app").innerHTML = `<div class="empty">数据未加载：请先运行 <code>pnpm web:export</code> 生成 web/data/data.js</div>`;
    return;
  }
  const c = DATA.meta.counts;
  document.getElementById("metaLine").textContent = `演员 ${c.actresses} · 作品 ${c.works} · 分类 ${c.genres}`;
  document.querySelectorAll("#tabs .tab").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));

  const modal = document.getElementById("modal");
  modal.addEventListener("click", (e) => {
    if (e.target === modal || e.target.closest("[data-close]")) closeModal();
    const t = e.target.closest("[data-open]");
    if (t) {
      const kind = t.dataset.open;
      const id = t.dataset.id;
      if (kind === "work") openWork(id);
      else if (kind === "actress") openActress(id);
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  setTab("actresses");
}

init();
