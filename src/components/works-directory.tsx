"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDirectoryUrl } from "@/hooks/use-directory-url";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { matchesSearch } from "@/lib/search";
import type { CatalogWork } from "@/server/catalog/types";
import { BookmarkIcon, SearchIcon } from "./icons";

export function WorksDirectory({ works: allWorks }: { works: CatalogWork[] }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("全部");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { library, toggleFavorite } = useLocalLibrary();
  const favoriteIds = library.favorites.works;
  const applyInitialFilters = useCallback((params: URLSearchParams) => {
    const nextYear = params.get("year");
    setQuery(params.get("q") ?? "");
    if (["2026", "2025", "2024"].includes(nextYear ?? "")) setYear(nextYear as string);
  }, []);
  useDirectoryUrl({ q: query.trim(), year: year === "全部" ? "" : year }, applyInitialFilters);
  const works = useMemo(
    () =>
      allWorks.filter(
        (work) =>
          (year === "全部" || String(work.releaseYear) === year) &&
          (!favoritesOnly || favoriteIds.includes(work.id)) &&
          matchesSearch(query, [
            work.code,
            work.title,
            work.originalTitle,
            work.maker,
            ...work.cast,
          ]),
      ),
    [allWorks, favoriteIds, favoritesOnly, query, year],
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
        <button
          className={favoritesOnly ? "filter-toggle is-active" : "filter-toggle"}
          type="button"
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <BookmarkIcon />
          只看收藏
        </button>
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
              <div className="work-heading-row">
                <span className="work-code">{work.code}</span>
                <button
                  className={favoriteIds.includes(work.id) ? "bookmark is-active" : "bookmark"}
                  type="button"
                  aria-label={`${favoriteIds.includes(work.id) ? "取消收藏" : "收藏"} ${work.title}`}
                  aria-pressed={favoriteIds.includes(work.id)}
                  onClick={() => toggleFavorite("works", work.id)}
                >
                  <BookmarkIcon />
                </button>
              </div>
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
