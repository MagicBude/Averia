import type { Metadata } from "next";

import { BookmarkIcon, SearchIcon, SlidersIcon } from "@/components/icons";
import { demoPeople } from "@/data/demo";

export const metadata: Metadata = { title: "人物档案 · Averia" };

export default function PeoplePage() {
  return (
    <main className="route-page">
      <header className="page-intro">
        <span className="section-number">01 / PEOPLE</span>
        <div>
          <h1>人物档案</h1>
          <p>通过姓名、艺名、活跃年份和出演关系查找人物。</p>
        </div>
      </header>
      <section className="directory-toolbar" aria-label="人物筛选">
        <label className="directory-search">
          <SearchIcon />
          <span className="sr-only">搜索人物</span>
          <input placeholder="搜索姓名或别名…" />
        </label>
        <button type="button">
          <SlidersIcon />
          全部筛选
        </button>
        <span>{demoPeople.length} 位虚构人物</span>
      </section>
      <section className="directory-grid" aria-label="人物列表">
        {demoPeople.map((person, index) => (
          <article className="person-card compact-person-card" key={person.id}>
            <div className={`portrait tone-${person.tone}`}>
              <span className="portrait-index">0{index + 1}</span>
              <span className="portrait-initials">{person.initials}</span>
              <button type="button" aria-label={`收藏 ${person.name}`}>
                <BookmarkIcon />
              </button>
            </div>
            <div className="card-body">
              <span className={`status status-${person.status === "活跃" ? "active" : "quiet"}`}>
                {person.status}
              </span>
              <h2>{person.name}</h2>
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
      </section>
    </main>
  );
}
