import type { Metadata } from "next";
import { PeopleDirectory } from "@/components/people-directory";

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
      <PeopleDirectory />
    </main>
  );
}
