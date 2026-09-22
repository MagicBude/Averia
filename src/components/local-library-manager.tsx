"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { demoPeople, demoWorks } from "@/data/demo";
import { useLocalLibrary } from "@/hooks/use-local-library";
import { createLibraryExport, parseLibraryExport, type LibraryExportV1 } from "@/lib/local-library";

type ImportPreview = {
  value: LibraryExportV1;
  known: number;
  missing: number;
};

export function LocalLibraryManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { library, mergeImport } = useLocalLibrary();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState("");
  const people = demoPeople.filter((person) => library.favorites.people.includes(person.id));
  const works = demoWorks.filter((work) => library.favorites.works.includes(work.id));

  function exportLibrary() {
    const payload = createLibraryExport(library);
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `averia-library-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("已导出版本 1 的本地资料库文件。");
  }

  async function inspectImport(file: File) {
    try {
      const value = parseLibraryExport(await file.text());
      const knownIds = new Set([
        ...demoPeople.map((item) => `person:${item.id}`),
        ...demoWorks.map((item) => `work:${item.id}`),
      ]);
      const known = value.items.filter((item) =>
        knownIds.has(`${item.entityType}:${item.entityId}`),
      ).length;
      setPreview({ value, known, missing: value.items.length - known });
      setMessage("");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "无法读取导入文件。");
    }
  }

  function confirmImport() {
    if (!preview) return;
    mergeImport(preview.value);
    setMessage(`已合并 ${preview.value.items.length} 条本地资料。`);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <>
      <section className="library-actions" aria-label="本地资料库工具">
        <div>
          <strong>{people.length + works.length}</strong>
          <span>项收藏</span>
        </div>
        <button type="button" onClick={exportLibrary}>
          导出 JSON
        </button>
        <label className="import-file">
          <span>导入 JSON</span>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void inspectImport(file);
            }}
          />
        </label>
      </section>
      {preview ? (
        <section className="import-preview" aria-live="polite">
          <div>
            <span className="section-number">IMPORT PREVIEW</span>
            <h2>导入前确认</h2>
            <p>
              共 {preview.value.items.length} 条；当前示例库可关联 {preview.known}{" "}
              条，找不到公开实体 {preview.missing} 条。
              导入采用合并策略，同一实体的标签与备注以文件内容为准。
            </p>
          </div>
          <button type="button" onClick={confirmImport}>
            确认合并
          </button>
        </section>
      ) : null}
      {message ? (
        <p className="library-message" role="status">
          {message}
        </p>
      ) : null}
      <section className="library-section">
        <span className="section-number">PEOPLE</span>
        <h2>收藏人物</h2>
        <div className="library-list">
          {people.map((person) => (
            <Link href={`/people/${person.slug}`} key={person.id}>
              <strong>{person.name}</strong>
              <span>{person.originalName}</span>
            </Link>
          ))}
          {people.length === 0 ? <p>还没有收藏人物。</p> : null}
        </div>
      </section>
      <section className="library-section">
        <span className="section-number">WORKS</span>
        <h2>收藏作品</h2>
        <div className="library-list">
          {works.map((work) => (
            <Link href={`/works/${work.slug}`} key={work.id}>
              <strong>{work.title}</strong>
              <span>
                {work.code} · {work.releaseDate}
              </span>
            </Link>
          ))}
          {works.length === 0 ? <p>还没有收藏作品。</p> : null}
        </div>
      </section>
    </>
  );
}
