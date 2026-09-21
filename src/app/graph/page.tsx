import type { Metadata } from "next";

export const metadata: Metadata = { title: "影格图谱 · Averia" };

export default function GraphPage() {
  return (
    <main className="route-page">
      <header className="page-intro">
        <span className="section-number">03 / RELATIONS</span>
        <div>
          <h1>影格图谱</h1>
          <p>用人物、艺名、作品、厂牌和系列之间的关系探索档案。</p>
        </div>
      </header>
      <section className="graph-preview" aria-label="关系图谱功能预览">
        <div className="graph-node graph-person">人物</div>
        <span className="graph-line line-one" />
        <div className="graph-node graph-work">作品</div>
        <span className="graph-line line-two" />
        <div className="graph-node graph-label">厂牌</div>
        <div className="graph-copy">
          <span>0.3 计划功能</span>
          <h2>关系比列表更接近真实世界。</h2>
          <p>
            这里将展示人物使用不同艺名参与作品，以及作品所属厂牌、系列和发行版本的关系。当前仅建立独立页面和信息架构。
          </p>
        </div>
      </section>
    </main>
  );
}
