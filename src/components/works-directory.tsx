"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDirectoryUrl } from "@/hooks/use-directory-url";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { findSearchMatch, normalizeSearchText } from "@/lib/search";
import type { CatalogWork } from "@/server/catalog/types";
import { BookmarkIcon, SearchIcon } from "./icons";

type WorkSort = "relevance" | "release-newest" | "release-oldest" | "name" | "code";

export function WorksDirectory({ works: allWorks }: { works: CatalogWork[] }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("全部");
  const [maker, setMaker] = useState("全部");
  const [tag, setTag] = useState("全部");
  const [castMember, setCastMember] = useState("全部");
  const [sort, setSort] = useState<WorkSort>("relevance");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { library, toggleFavorite } = useLocalLibrary();
  const favoriteIds = library.favorites.works;
  const applyInitialFilters = useCallback(
    (params: URLSearchParams) => {
      const nextYear = params.get("year");
      const nextMaker = params.get("maker");
      const nextTag = params.get("tag");
      const nextCast = params.get("cast");
      const nextSort = params.get("sort");
      setQuery(params.get("q") ?? "");
      if (allWorks.some((work) => String(work.releaseYear) === nextYear))
        setYear(nextYear ?? "全部");
      if (allWorks.some((work) => work.maker === nextMaker)) setMaker(nextMaker ?? "全部");
      if (allWorks.some((work) => work.tags.includes(nextTag ?? ""))) setTag(nextTag ?? "全部");
      if (allWorks.some((work) => work.cast.includes(nextCast ?? ""))) {
        setCastMember(nextCast ?? "全部");
      }
      if (["release-newest", "release-oldest", "name", "code"].includes(nextSort ?? "")) {
        setSort(nextSort as WorkSort);
      }
    },
    [allWorks],
  );
  useDirectoryUrl(
    {
      q: query.trim(),
      year: year === "全部" ? "" : year,
      maker: maker === "全部" ? "" : maker,
      tag: tag === "全部" ? "" : tag,
      cast: castMember === "全部" ? "" : castMember,
      sort: sort === "relevance" ? "" : sort,
    },
    applyInitialFilters,
  );
  const filterOptions = useMemo(
    () => ({
      years: [...new Set(allWorks.map((work) => work.releaseYear))].sort((a, b) => b - a),
      makers: [...new Set(allWorks.map((work) => work.maker))].sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
      tags: [...new Set(allWorks.flatMap((work) => work.tags))].sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
      cast: [...new Set(allWorks.flatMap((work) => work.cast))].sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
    }),
    [allWorks],
  );
  const works = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const results = allWorks.flatMap((work) => {
      if (year !== "全部" && String(work.releaseYear) !== year) return [];
      if (maker !== "全部" && work.maker !== maker) return [];
      if (tag !== "全部" && !work.tags.includes(tag)) return [];
      if (castMember !== "全部" && !work.cast.includes(castMember)) return [];
      if (favoritesOnly && !favoriteIds.includes(work.id)) return [];

      const values = [
        work.title,
        work.originalTitle,
        work.code,
        work.maker,
        ...work.cast,
        ...work.tags,
      ];
      const match = findSearchMatch(query, values);
      if (normalizedQuery && !match) return [];
      const completeness =
        Number(Boolean(work.synopsis)) +
        work.cast.length +
        work.tags.length +
        Number(Boolean(work.maker));
      return [{ work, match, completeness }];
    });

    return results.sort((left, right) => {
      if (sort === "release-newest")
        return right.work.releaseDate.localeCompare(left.work.releaseDate);
      if (sort === "release-oldest")
        return left.work.releaseDate.localeCompare(right.work.releaseDate);
      if (sort === "name") return left.work.title.localeCompare(right.work.title, "zh-CN");
      if (sort === "code") return left.work.code.localeCompare(right.work.code, "zh-CN");
      return (
        (right.match?.score ?? 0) - (left.match?.score ?? 0) ||
        right.completeness - left.completeness ||
        right.work.releaseDate.localeCompare(left.work.releaseDate)
      );
    });
  }, [allWorks, castMember, favoriteIds, favoritesOnly, maker, query, sort, tag, year]);

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
        <div className="directory-filters">
          <select
            aria-label="发行年份"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option>全部</option>
            {filterOptions.years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="厂牌或发行商"
            value={maker}
            onChange={(event) => setMaker(event.target.value)}
          >
            <option>全部</option>
            {filterOptions.makers.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="规范标签"
            value={tag}
            onChange={(event) => setTag(event.target.value)}
          >
            <option>全部</option>
            {filterOptions.tags.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="出演关系"
            value={castMember}
            onChange={(event) => setCastMember(event.target.value)}
          >
            <option>全部</option>
            {filterOptions.cast.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <select
            aria-label="作品排序"
            value={sort}
            onChange={(event) => setSort(event.target.value as WorkSort)}
          >
            <option value="relevance">相关度 + 完整度</option>
            <option value="release-newest">发行日期：新到旧</option>
            <option value="release-oldest">发行日期：旧到新</option>
            <option value="name">名称</option>
            <option value="code">作品编号</option>
          </select>
        </div>
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
        {works.map(({ work, match }) => (
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
              {query.trim() && match && match.index > 0 ? (
                <p className="search-match">命中：{match.value}</p>
              ) : null}
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
