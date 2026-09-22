"use client";

import { useCallback, useEffect, useState } from "react";
import {
  EMPTY_LIBRARY,
  entityKey,
  mergeLibraryExport,
  normalizeStoredLibrary,
  type EntityType,
  type FavoriteKind,
  type LibraryExportV1,
  type LocalLibraryV1,
} from "@/lib/local-library";

const STORAGE_KEY = "averia:local-library:v1";
const LIBRARY_EVENT = "averia:local-library-change";
function readLibrary(): LocalLibraryV1 {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_LIBRARY;

  try {
    return normalizeStoredLibrary(JSON.parse(raw));
  } catch {
    // 损坏的本地数据不能阻断页面；导入功能会提供显式错误反馈。
    return EMPTY_LIBRARY;
  }
}

function writeLibrary(value: LocalLibraryV1) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(LIBRARY_EVENT));
}

export function useLocalLibrary() {
  const [library, setLibrary] = useState<LocalLibraryV1>(EMPTY_LIBRARY);

  useEffect(() => {
    const refresh = () => setLibrary(readLibrary());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(LIBRARY_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(LIBRARY_EVENT, refresh);
    };
  }, []);

  const toggleFavorite = useCallback((kind: FavoriteKind, id: string) => {
    const current = readLibrary();
    const ids = current.favorites[kind];
    const nextIds = ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
    writeLibrary({
      ...current,
      favorites: { ...current.favorites, [kind]: nextIds },
    });
  }, []);

  const updateAnnotation = useCallback(
    (entityType: EntityType, entityId: string, annotation: { tags: string[]; note: string }) => {
      const current = readLibrary();
      writeLibrary({
        ...current,
        annotations: { ...current.annotations, [entityKey(entityType, entityId)]: annotation },
      });
    },
    [],
  );

  const mergeImport = useCallback((value: LibraryExportV1) => {
    writeLibrary(mergeLibraryExport(readLibrary(), value));
  }, []);

  return { library, toggleFavorite, updateAnnotation, mergeImport };
}
