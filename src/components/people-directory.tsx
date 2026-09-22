"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDirectoryUrl } from "@/hooks/use-directory-url";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { findSearchMatch, normalizeSearchText } from "@/lib/search";
import type { CatalogPerson } from "@/server/catalog/types";
import { BookmarkIcon, SearchIcon } from "./icons";

type StatusFilter = "全部" | "活跃" | "引退" | "资料待确认";
type PeopleSort = "relevance" | "debut-newest" | "debut-oldest" | "name";

export function PeopleDirectory({ people: allPeople }: { people: CatalogPerson[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("全部");
  const [debutYear, setDebutYear] = useState("全部");
  const [sort, setSort] = useState<PeopleSort>("relevance");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { library, toggleFavorite } = useLocalLibrary();
  const favoriteIds = library.favorites.people;
  const applyInitialFilters = useCallback(
    (params: URLSearchParams) => {
      const nextStatus = params.get("status");
      const nextDebutYear = params.get("debut");
      const nextSort = params.get("sort");
      setQuery(params.get("q") ?? "");
      if (["活跃", "引退", "资料待确认"].includes(nextStatus ?? "")) {
        setStatus(nextStatus as StatusFilter);
      }
      if (allPeople.some((person) => String(person.debutYear) === nextDebutYear)) {
        setDebutYear(nextDebutYear ?? "全部");
      }
      if (["debut-newest", "debut-oldest", "name"].includes(nextSort ?? "")) {
        setSort(nextSort as PeopleSort);
      }
    },
    [allPeople],
  );
  useDirectoryUrl(
    {
      q: query.trim(),
      status: status === "全部" ? "" : status,
      debut: debutYear === "全部" ? "" : debutYear,
      sort: sort === "relevance" ? "" : sort,
    },
    applyInitialFilters,
  );
  const debutYears = useMemo(
    () => [...new Set(allPeople.map((person) => person.debutYear))].sort((a, b) => b - a),
    [allPeople],
  );
  const people = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    const results = allPeople.flatMap((person) => {
      if (status !== "全部" && person.status !== status) return [];
      if (debutYear !== "全部" && String(person.debutYear) !== debutYear) return [];
      if (favoritesOnly && !favoriteIds.includes(person.id)) return [];

      const values = [person.name, person.originalName, person.romanizedName, ...person.aliases];
      const match = findSearchMatch(query, values);
      if (normalizedQuery && !match) return [];
      const completeness =
        Number(Boolean(person.biography)) + person.aliases.length + person.timeline.length;
      return [{ person, match, completeness }];
    });

    return results.sort((left, right) => {
      if (sort === "debut-newest") return right.person.debutYear - left.person.debutYear;
      if (sort === "debut-oldest") return left.person.debutYear - right.person.debutYear;
      if (sort === "name") return left.person.name.localeCompare(right.person.name, "zh-CN");
      return (
        (right.match?.score ?? 0) - (left.match?.score ?? 0) ||
        right.completeness - left.completeness ||
        left.person.name.localeCompare(right.person.name, "zh-CN")
      );
    });
  }, [allPeople, debutYear, favoriteIds, favoritesOnly, query, sort, status]);

  return (
    <>
      <section className="directory-toolbar" aria-label="人物筛选">
        <label className="directory-search">
          <SearchIcon />
          <span className="sr-only">搜索人物</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索姓名或别名…"
          />
        </label>
        <div className="directory-filters">
          <select
            aria-label="人物状态"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option>全部</option>
            <option>活跃</option>
            <option>引退</option>
            <option>资料待确认</option>
          </select>
          <select
            aria-label="出道年份"
            value={debutYear}
            onChange={(event) => setDebutYear(event.target.value)}
          >
            <option>全部</option>
            {debutYears.map((year) => (
              <option key={year}>{year}</option>
            ))}
          </select>
          <select
            aria-label="人物排序"
            value={sort}
            onChange={(event) => setSort(event.target.value as PeopleSort)}
          >
            <option value="relevance">相关度 + 完整度</option>
            <option value="debut-newest">出道日期：新到旧</option>
            <option value="debut-oldest">出道日期：旧到新</option>
            <option value="name">名称</option>
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
        <span>{people.length} 位虚构人物</span>
      </section>
      <section className="directory-grid" aria-label="人物列表">
        {people.map(({ person, match }, index) => (
          <article className="person-card compact-person-card" key={person.id}>
            <Link href={`/people/${person.slug}`} className={`portrait tone-${person.tone}`}>
              <span className="portrait-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="portrait-initials">{person.initials}</span>
            </Link>
            <div className="card-body">
              <div className="card-status-row">
                <span className={`status status-${person.status === "活跃" ? "active" : "quiet"}`}>
                  {person.status}
                </span>
                <button
                  className={favoriteIds.includes(person.id) ? "bookmark is-active" : "bookmark"}
                  type="button"
                  aria-label={`${favoriteIds.includes(person.id) ? "取消收藏" : "收藏"} ${person.name}`}
                  aria-pressed={favoriteIds.includes(person.id)}
                  onClick={() => toggleFavorite("people", person.id)}
                >
                  <BookmarkIcon />
                </button>
              </div>
              <Link href={`/people/${person.slug}`}>
                <h2>{person.name}</h2>
              </Link>
              <p>
                {person.originalName}
                <br />
                <small>{person.romanizedName}</small>
              </p>
              {query.trim() && match && match.index > 0 ? (
                <p className="search-match">命中：{match.value}</p>
              ) : null}
              <div className="card-meta">
                <span>{person.debutYear} 出道</span>
                <span>{person.workCount} 部作品</span>
              </div>
            </div>
          </article>
        ))}
        {people.length === 0 ? <p className="empty-result">没有符合条件的人物。</p> : null}
      </section>
    </>
  );
}
