import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

import "./globals.css";

const sans = Noto_Sans_SC({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const serif = Noto_Serif_SC({ variable: "--font-serif", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Averia · 演员档案、作品关系与多维检索",
  description: "以来源证据为基础的演员档案、作品关系与多维检索平台。",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
