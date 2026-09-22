import type { Metadata } from "next";
import { WorksDirectory } from "@/components/works-directory";

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
      <WorksDirectory />
    </main>
  );
}
