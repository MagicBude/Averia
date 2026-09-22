"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { PreferenceControls } from "./preference-controls";

const navigation = [
  { href: "/people", label: "人物" },
  { href: "/works", label: "作品" },
  { href: "/graph", label: "影格图谱" },
  { href: "/library", label: "收藏" },
  { href: "/about", label: "关于" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Averia 首页">
        <span className="brand-mark" aria-hidden="true">
          A
        </span>
        <span>
          <strong>Averia</strong>
          <small>档案 · 关系 · 检索</small>
        </span>
      </Link>
      <nav className="primary-nav" aria-label="主要导航">
        {navigation.map((item) => (
          <Link
            className={pathname === item.href ? "is-active" : undefined}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <PreferenceControls />
    </header>
  );
}
