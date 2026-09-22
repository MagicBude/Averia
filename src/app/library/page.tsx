import type { Metadata } from "next";
import { LocalLibraryManager } from "@/components/local-library-manager";

export const metadata: Metadata = { title: "本地资料库 · Averia" };

export default function LibraryPage() {
  return (
    <main className="route-page">
      <header className="page-intro">
        <span className="section-number">04 / LOCAL LIBRARY</span>
        <div>
          <h1>本地资料库</h1>
          <p>
            管理收藏、私有标签和备注，并通过带版本号的 JSON
            文件在设备之间迁移。所有内容仅保存在本地。
          </p>
        </div>
      </header>
      <LocalLibraryManager />
    </main>
  );
}
