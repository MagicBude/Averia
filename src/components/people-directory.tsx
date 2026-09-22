"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useDirectoryUrl } from "@/hooks/use-directory-url";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { matchesSearch } from "@/lib/search";
import type { CatalogPerson } from "@/server/catalog/types";
import { BookmarkIcon, SearchIcon } from "./icons";

type StatusFilter = "全部" | "活跃" | "引退" | "资料待确认";

export function PeopleDirectory({ people: allPeople }: { people: CatalogPerson[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("全部");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { library, toggleFavorite } = useLocalLibrary();
  const favoriteIds = library.favorites.people;
  const applyInitialFilters = useCallback((params: URLSearchParams) => {
    const nextStatus = params.get("status");
    setQuery(params.get("q") ?? "");
    if (["活跃", "引退", "资料待确认"].includes(nextStatus ?? "")) {
      setStatus(nextStatus as StatusFilter);
    }
  }, []);
  useDirectoryUrl(
    { q: query.trim(), status: status === "全部" ? "" : status },
    applyInitialFilters,
  );
  const people = useMemo(
    () =>
      allPeople.filter(
        (person) =>
          (status === "全部" || person.status === status) &&
          (!favoritesOnly || favoriteIds.includes(person.id)) &&
          matchesSearch(query, [
            person.name,
            person.originalName,
            person.romanizedName,
            ...person.aliases,
          ]),
      ),
    [allPeople, favoriteIds, favoritesOnly, query, status],
  );

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
        {people.map((person, index) => (
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
