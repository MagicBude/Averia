"use client";

import { useCallback, useEffect, useState } from "react";

type FavoriteKind = "people" | "works";

export type LocalLibraryV1 = {
  version: 1;
  favorites: Record<FavoriteKind, string[]>;
};

const STORAGE_KEY = "averia:local-library:v1";
const LIBRARY_EVENT = "averia:local-library-change";
const EMPTY_LIBRARY: LocalLibraryV1 = {
  version: 1,
  favorites: { people: [], works: [] },
};

function readLibrary(): LocalLibraryV1 {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_LIBRARY;

  try {
    const value = JSON.parse(raw) as Partial<LocalLibraryV1>;
    if (value.version !== 1 || !value.favorites) return EMPTY_LIBRARY;

    return {
      version: 1,
      favorites: {
        people: Array.isArray(value.favorites.people) ? value.favorites.people : [],
        works: Array.isArray(value.favorites.works) ? value.favorites.works : [],
      },
    };
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

  return { library, toggleFavorite };
}
