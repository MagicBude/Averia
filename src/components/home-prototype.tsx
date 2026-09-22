"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { matchesSearch, normalizeSearchText } from "@/lib/search";
import type { CatalogPerson, CatalogWork } from "@/server/catalog/types";

import { ArrowIcon, SearchIcon, SlidersIcon } from "./icons";

export function HomePrototype({
  people,
  works,
}: {
  people: CatalogPerson[];
  works: CatalogWork[];
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearchText(query);
  const matchingPeople = useMemo(
    () =>
      people.filter((person) =>
        matchesSearch(normalizedQuery, [person.name, person.originalName, person.romanizedName]),
      ),
    [normalizedQuery, people],
  );
  const matchingWorks = useMemo(
    () =>
      works.filter((work) =>
        matchesSearch(normalizedQuery, [
          work.code,
          work.title,
          work.originalTitle,
          work.maker,
          ...work.cast,
        ]),
      ),
    [normalizedQuery, works],
  );

  return (
    <main id="top">
      <section className="hero" aria-labelledby="hero-title">
        <div className="eyebrow">
          <span>AVERIA ARCHIVE</span>
          <span className="line" />
          <span>0.1 PREVIEW</span>
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
          <Link className="filter-button" href="/people">
            <SlidersIcon />
            组合筛选
          </Link>
        </div>
        <div className="quick-filters" aria-label="快速入口">
          <span>快速进入</span>
          <Link href="/people">活跃人物</Link>
          <Link href="/works">2026 新作</Link>
          <Link href="/people">资料完整度高</Link>
          <Link href="/works">多人出演</Link>
        </div>
        <dl className="hero-index" aria-label="数据库规模示例">
          <div>
            <dt>人物</dt>
            <dd>2,486</dd>
          </div>
          <div>
            <dt>作品</dt>
            <dd>38,912</dd>
          </div>
          <div>
            <dt>来源记录</dt>
            <dd>186,000</dd>
          </div>
        </dl>
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
              <Link href="/people" key={person.id} className="compact-result">
                <span className={`avatar tone-${person.tone}`}>{person.initials}</span>
                <div>
                  <strong>{person.name}</strong>
                  <span>
                    {person.originalName} · {person.romanizedName}
                  </span>
                </div>
                <small>人物 · {person.workCount} 部作品</small>
              </Link>
            ))}
            {matchingWorks.map((work) => (
              <Link href="/works" key={work.id} className="compact-result">
                <span className={`mini-poster poster-${work.tone}`} />
                <div>
                  <strong>{work.title}</strong>
                  <span>
                    {work.code} · {work.originalTitle}
                  </span>
                </div>
                <small>作品 · {work.releaseYear}</small>
              </Link>
            ))}
            {matchingPeople.length + matchingWorks.length === 0 ? (
              <p className="empty-result">没有匹配的虚构示例。</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="portal-section" aria-labelledby="portal-title">
        <div className="section-heading">
          <div>
            <span className="section-number">EXPLORE</span>
            <h2 id="portal-title">分区浏览</h2>
          </div>
        </div>
        <div className="portal-grid">
          <Link href="/people">
            <span>01</span>
            <div>
              <h3>人物档案</h3>
              <p>姓名、艺名、职业时间线与出演关系。</p>
            </div>
            <ArrowIcon />
          </Link>
          <Link href="/works">
            <span>02</span>
            <div>
              <h3>作品索引</h3>
              <p>作品、发行版本、编号与厂牌关系。</p>
            </div>
            <ArrowIcon />
          </Link>
          <Link href="/graph">
            <span>03</span>
            <div>
              <h3>影格图谱</h3>
              <p>从人物与作品之间探索结构化关系。</p>
            </div>
            <ArrowIcon />
          </Link>
          <Link href="/library">
            <span>04</span>
            <div>
              <h3>本地资料库</h3>
              <p>收藏、私有标签、备注与本地迁移。</p>
            </div>
            <ArrowIcon />
          </Link>
          <Link href="/about">
            <span>05</span>
            <div>
              <h3>关于 Averia</h3>
              <p>收录原则、来源证据与权利处理。</p>
            </div>
            <ArrowIcon />
          </Link>
        </div>
      </section>
    </main>
  );
}
