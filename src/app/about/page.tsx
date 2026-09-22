import type { Metadata } from "next";

export const metadata: Metadata = { title: "关于 · Averia" };

export default function AboutPage() {
  return (
    <main className="route-page about-page">
      <header className="page-intro">
        <span className="section-number">05 / ABOUT</span>
        <div>
          <h1>关于 Averia</h1>
          <p>档案不是答案，而是可以回到来源重新判断的记录。</p>
        </div>
      </header>
      <section className="about-grid">
        <article>
          <span>01</span>
          <h2>来源优先</h2>
          <p>重要字段保存来源、采集时间和可信度，不让聚合结果掩盖证据。</p>
        </article>
        <article>
          <span>02</span>
          <h2>冲突可见</h2>
          <p>来源不一致时进入人工审核，不用模糊匹配替用户做身份决定。</p>
        </article>
        <article id="rights">
          <span>03</span>
          <h2>权利与安全</h2>
          <p>提供资料更正、人物权利、图片版权和安全举报入口；高风险内容先隐藏再复核。</p>
        </article>
        <article id="open-source">
          <span>04</span>
          <h2>开放代码</h2>
          <p>程序代码使用 MIT 许可证；数据、图片、品牌和第三方内容不自动适用该许可。</p>
        </article>
      </section>
    </main>
  );
}
