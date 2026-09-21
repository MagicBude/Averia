import type { Metadata } from "next";

import { SearchIcon, SlidersIcon } from "@/components/icons";
import { demoWorks } from "@/data/demo";

export const metadata: Metadata = { title: "作品索引 · Averia" };

export default function WorksPage() {
  return (
    <main className="route-page">
      <header className="page-intro">
        <span className="section-number">02 / WORKS</span>
        <div>
          <h1>作品索引</h1>
          <p>按编号、发行年份、厂牌、系列和出演关系组合筛选。</p>
        </div>
      </header>
      <section className="directory-toolbar" aria-label="作品筛选">
        <label className="directory-search">
          <SearchIcon />
          <span className="sr-only">搜索作品</span>
          <input placeholder="搜索标题、编号或演员…" />
        </label>
        <button type="button">
          <SlidersIcon />
          全部筛选
        </button>
        <span>{demoWorks.length} 部虚构作品</span>
      </section>
      <section className="work-grid directory-works" aria-label="作品列表">
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
              <h2>{work.title}</h2>
              <p>{work.originalTitle}</p>
              <div className="work-meta">
                <span>{work.releaseYear}</span>
                <span>{work.maker}</span>
              </div>
              <p className="cast">出演：{work.cast.join("、")}</p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
