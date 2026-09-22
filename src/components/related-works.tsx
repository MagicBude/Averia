"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { DemoWork } from "@/data/demo";

type SortOrder = "newest" | "oldest" | "name" | "code";

const chineseCollator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

function formatReleaseDate(value: string) {
  return value.replaceAll("-", ".");
}

export function RelatedWorks({ works }: { works: DemoWork[] }) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const sortedWorks = useMemo(() => {
    const result = [...works];

    return result.sort((left, right) => {
      if (sortOrder === "oldest") return left.releaseDate.localeCompare(right.releaseDate);
      if (sortOrder === "name") return chineseCollator.compare(left.title, right.title);
      if (sortOrder === "code") return chineseCollator.compare(left.code, right.code);
      return right.releaseDate.localeCompare(left.releaseDate);
    });
  }, [sortOrder, works]);

  return (
    <section className="related-section">
      <div className="related-heading">
        <div>
          <span className="section-number">WORKS</span>
          <h2>关联作品</h2>
        </div>
        <label className="related-sort">
          <span>排序</span>
          <select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          >
            <option value="newest">发行日期：新到旧</option>
            <option value="oldest">发行日期：旧到新</option>
            <option value="name">作品名称</option>
            <option value="code">作品编号</option>
          </select>
        </label>
      </div>
      <div className="related-links" aria-live="polite">
        {sortedWorks.map((work) => (
          <Link href={`/works/${work.slug}`} key={work.id}>
            <small>{work.code}</small>
            <strong>{work.title}</strong>
            <span>
              {formatReleaseDate(work.releaseDate)} · {work.maker}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
