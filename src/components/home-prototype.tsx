"use client";

import { useMemo, useState } from "react";

import { demoPeople, demoWorks } from "@/data/demo";
import { matchesSearch, normalizeSearchText } from "@/lib/search";

import { ArrowIcon, BookmarkIcon, GridIcon, SearchIcon, SlidersIcon } from "./icons";
import { PreferenceControls } from "./preference-controls";

export function HomePrototype() {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query);
  const matchingPeople = useMemo(
    () =>
      demoPeople.filter((person) =>
        matchesSearch(normalizedQuery, [person.name, person.originalName, person.romanizedName]),
      ),
    [normalizedQuery],
  );
  const matchingWorks = useMemo(
    () =>
      demoWorks.filter((work) =>
        matchesSearch(normalizedQuery, [
          work.code,
          work.title,
          work.originalTitle,
          work.maker,
          ...work.cast,
        ]),
      ),
    [normalizedQuery],
  );

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Averia 首页">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <span>
            <strong>Averia</strong>
            <small>档案 · 关系 · 检索</small>
          </span>
        </a>
        <nav className="primary-nav" aria-label="主要导航">
          <a className="is-active" href="#people">
            人物
          </a>
          <a href="#works">作品</a>
          <a href="#relations">影格图谱</a>
          <a href="#about">关于</a>
        </nav>
        <PreferenceControls />
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span>AVERIA ARCHIVE</span>
            <span className="line" /> <span>0.1 PREVIEW</span>
          </div>
          <div className="hero-copy">
            <h1 id="hero-title">
              从名字出发，
              <br />
              <em>找到每一段作品关系。</em>
            </h1>
            <p>以可核查来源连接人物、艺名、作品与发行版本。中文检索，保留日文原名与罗马字。</p>
          </div>
          <div className="search-panel">
            <label className="search-box">
              <SearchIcon />
              <span className="sr-only">全库搜索</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索姓名、别名、作品标题或编号…"
              />
              <kbd>⌘ K</kbd>
            </label>
            <button className="filter-button" type="button">
              <SlidersIcon />
              组合筛选
            </button>
          </div>
          <div className="quick-filters" aria-label="快速筛选">
            <span>快速进入</span>
            <button type="button">活跃人物</button>
            <button type="button">2026 新作</button>
            <button type="button">资料完整度高</button>
            <button type="button">多人出演</button>
          </div>
          <div className="hero-index" aria-hidden="true">
            <span>人物</span>
            <strong>2,486</strong>
            <span>作品</span>
            <strong>38,912</strong>
            <span>来源记录</span>
            <strong>186K</strong>
          </div>
        </section>

        {normalizedQuery ? (
          <section className="search-results" aria-live="polite">
            <div className="section-heading">
              <div>
                <span className="section-number">检索结果</span>
                <h2>“{query}”</h2>
              </div>
              <span>{matchingPeople.length + matchingWorks.length} 条虚构示例</span>
            </div>
            <div className="result-list">
              {matchingPeople.map((person) => (
                <article key={person.id} className="compact-result">
                  <span className={`avatar tone-${person.tone}`}>{person.initials}</span>
                  <div>
                    <strong>{person.name}</strong>
                    <span>
                      {person.originalName} · {person.romanizedName}
                    </span>
                  </div>
                  <small>人物 · {person.workCount} 部作品</small>
                </article>
              ))}
              {matchingWorks.map((work) => (
                <article key={work.id} className="compact-result">
                  <span className={`mini-poster poster-${work.tone}`} />
                  <div>
                    <strong>{work.title}</strong>
                    <span>
                      {work.code} · {work.originalTitle}
                    </span>
                  </div>
                  <small>作品 · {work.releaseYear}</small>
                </article>
              ))}
              {matchingPeople.length + matchingWorks.length === 0 ? (
                <p className="empty-result">
                  没有匹配的虚构示例。完整搜索将在后续版本连接 PostgreSQL。
                </p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="content-section" id="people">
          <div className="section-heading">
            <div>
              <span className="section-number">01 / PEOPLE</span>
              <h2>近期整理人物</h2>
            </div>
            <a href="#people">
              浏览全部 <ArrowIcon />
            </a>
          </div>
          <div className="people-grid">
            {demoPeople.map((person, index) => (
              <article className="person-card" key={person.id}>
                <div className={`portrait tone-${person.tone}`}>
                  <span className="portrait-index">0{index + 1}</span>
                  <span className="portrait-initials">{person.initials}</span>
                  <button type="button" aria-label={`收藏 ${person.name}`}>
                    <BookmarkIcon />
                  </button>
                </div>
                <div className="card-body">
                  <span
                    className={`status status-${person.status === "活跃" ? "active" : "quiet"}`}
                  >
                    {person.status}
                  </span>
                  <h3>{person.name}</h3>
                  <p>
                    {person.originalName}
                    <br />
                    <small>{person.romanizedName}</small>
                  </p>
                  <div className="card-meta">
                    <span>{person.debutYear} 出道</span>
                    <span>{person.workCount} 部作品</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section works-section" id="works">
          <div className="section-heading">
            <div>
              <span className="section-number">02 / WORKS</span>
              <h2>最近发行作品</h2>
            </div>
            <div className="view-actions">
              <button className="is-active" type="button" aria-label="卡片视图">
                <GridIcon />
              </button>
              <a href="#works">
                浏览全部 <ArrowIcon />
              </a>
            </div>
          </div>
          <div className="work-grid">
            {demoWorks.map((work) => (
              <article className="work-card" key={work.id}>
                <div className={`work-cover poster-${work.tone}`}>
                  <span>
                    AVERIA
                    <br />
                    ARCHIVE
                  </span>
                  <small>{work.code}</small>
                </div>
                <div className="work-copy">
                  <span className="work-code">{work.code}</span>
                  <h3>{work.title}</h3>
                  <p>{work.originalTitle}</p>
                  <div className="work-meta">
                    <span>{work.releaseYear}</span>
                    <span>{work.maker}</span>
                  </div>
                  <p className="cast">出演：{work.cast.join("、")}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="principles" id="relations">
          <div>
            <span className="section-number">03 / TRUST</span>
            <h2>
              档案不是答案，
              <br />
              而是可追溯的判断。
            </h2>
          </div>
          <div className="principle-list">
            <article>
              <strong>01</strong>
              <div>
                <h3>来源优先</h3>
                <p>重要字段保存来源、采集时间和可信度，不让聚合结果掩盖证据。</p>
              </div>
            </article>
            <article>
              <strong>02</strong>
              <div>
                <h3>冲突可见</h3>
                <p>来源不一致时进入人工审核，不用模糊匹配替你做身份决定。</p>
              </div>
            </article>
            <article>
              <strong>03</strong>
              <div>
                <h3>隐私分层</h3>
                <p>公共档案与浏览器本地收藏分开，私人偏好不上传、不进入分享链接。</p>
              </div>
            </article>
          </div>
        </section>
      </main>

      <footer id="about">
        <div className="brand footer-brand">
          <span className="brand-mark">A</span>
          <span>
            <strong>Averia</strong>
            <small>演员档案、作品关系与多维检索</small>
          </span>
        </div>
        <p>当前为仅含虚构数据的 0.1 设计原型。</p>
        <nav>
          <a href="#about">收录原则</a>
          <a href="#about">更正与权利</a>
          <a href="#about">开源项目</a>
        </nav>
      </footer>
    </div>
  );
}
