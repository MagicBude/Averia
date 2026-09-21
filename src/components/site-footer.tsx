import Link from "next/link";

export function SiteFooter() {
  return (
    <footer id="about">
      <div className="brand footer-brand">
        <span className="brand-mark">A</span>
        <span>
          <strong>Averia</strong>
          <small>演员档案、作品关系与多维检索</small>
        </span>
      </div>
      <p>当前为仅含虚构数据的 0.1 设计原型。</p>
      <nav>
        <Link href="/about">收录原则</Link>
        <Link href="/about#rights">更正与权利</Link>
        <Link href="/about#open-source">开源项目</Link>
      </nav>
    </footer>
  );
}
