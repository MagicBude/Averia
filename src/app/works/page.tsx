import type { Metadata } from "next";
import { WorksDirectory } from "@/components/works-directory";
import { getCatalogRepository } from "@/server/catalog/repository";

export const metadata: Metadata = { title: "作品索引 · Averia" };

export default async function WorksPage() {
  const repository = await getCatalogRepository();
  const works = await repository.listWorks();
  return (
    <main className="route-page">
      <header className="page-intro">
        <span className="section-number">02 / WORKS</span>
        <div>
          <h1>作品索引</h1>
          <p>按编号、发行年份、厂牌、系列和出演关系组合筛选。</p>
        </div>
      </header>
      <WorksDirectory works={works} />
    </main>
  );
}
