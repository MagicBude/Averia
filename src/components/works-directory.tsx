"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { demoWorks } from "@/data/demo";
import { matchesSearch } from "@/lib/search";
import { SearchIcon } from "./icons";

export function WorksDirectory() {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("全部");
  const works = useMemo(
    () =>
      demoWorks.filter(
        (work) =>
          (year === "全部" || String(work.releaseYear) === year) &&
          matchesSearch(query, [
            work.code,
            work.title,
            work.originalTitle,
            work.maker,
            ...work.cast,
          ]),
      ),
    [query, year],
  );

  return (
    <>
      <section className="directory-toolbar" aria-label="作品筛选">
        <label className="directory-search">
          <SearchIcon />
          <span className="sr-only">搜索作品</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、编号或演员…"
          />
        </label>
        <select
          aria-label="发行年份"
          value={year}
          onChange={(event) => setYear(event.target.value)}
        >
          <option>全部</option>
          <option>2026</option>
          <option>2025</option>
          <option>2024</option>
        </select>
        <span>{works.length} 部虚构作品</span>
      </section>
      <section className="work-grid directory-works" aria-label="作品列表">
        {works.map((work) => (
          <article className="work-card" key={work.id}>
            <Link href={`/works/${work.slug}`} className={`work-cover poster-${work.tone}`}>
              <span>
                AVERIA
                <br />
                ARCHIVE
              </span>
              <small>{work.code}</small>
            </Link>
            <div className="work-copy">
              <span className="work-code">{work.code}</span>
              <Link href={`/works/${work.slug}`}>
                <h2>{work.title}</h2>
              </Link>
              <p>{work.originalTitle}</p>
              <div className="work-meta">
                <span>{work.releaseYear}</span>
                <span>{work.maker}</span>
              </div>
              <p className="cast">出演：{work.cast.join("、")}</p>
            </div>
          </article>
        ))}
        {works.length === 0 ? <p className="empty-result">没有符合条件的作品。</p> : null}
      </section>
    </>
  );
}
