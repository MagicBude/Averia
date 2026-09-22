"use client";

import { useEffect, useState } from "react";

type FilterValues = Record<string, string>;

export function useDirectoryUrl<T extends FilterValues>(
  filters: T,
  applyInitialFilters: (params: URLSearchParams) => void,
) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      applyInitialFilters(new URLSearchParams(window.location.search));
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [applyInitialFilters]);

  useEffect(() => {
    if (!ready) return;

    const url = new URL(window.location.href);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    });
    window.history.replaceState(window.history.state, "", url);
  }, [filters, ready]);
}
