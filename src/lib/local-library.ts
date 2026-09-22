export type FavoriteKind = "people" | "works";
export type EntityType = "person" | "work";

export type LocalAnnotation = {
  tags: string[];
  note: string;
};

export type LocalLibraryV1 = {
  version: 1;
  favorites: Record<FavoriteKind, string[]>;
  annotations: Record<string, LocalAnnotation>;
};

export type LibraryExportItem = LocalAnnotation & {
  entityType: EntityType;
  entityId: string;
  favorite: boolean;
};

export type LibraryExportV1 = {
  format: "averia-local-library";
  version: 1;
  exportedAt: string;
  items: LibraryExportItem[];
};

export const EMPTY_LIBRARY: LocalLibraryV1 = {
  version: 1,
  favorites: { people: [], works: [] },
  annotations: {},
};

export function entityKey(entityType: EntityType, entityId: string) {
  return `${entityType}:${entityId}`;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
    : [];
}

export function normalizeStoredLibrary(value: unknown): LocalLibraryV1 {
  if (!value || typeof value !== "object") return EMPTY_LIBRARY;
  const candidate = value as Partial<LocalLibraryV1>;
  if (candidate.version !== 1 || !candidate.favorites) return EMPTY_LIBRARY;

  const annotations: Record<string, LocalAnnotation> = {};
  if (candidate.annotations && typeof candidate.annotations === "object") {
    Object.entries(candidate.annotations).forEach(([key, annotation]) => {
      if (!annotation || typeof annotation !== "object") return;
      annotations[key] = {
        tags: stringArray(annotation.tags),
        note: typeof annotation.note === "string" ? annotation.note : "",
      };
    });
  }

  return {
    version: 1,
    favorites: {
      people: stringArray(candidate.favorites.people),
      works: stringArray(candidate.favorites.works),
    },
    annotations,
  };
}

export function createLibraryExport(
  library: LocalLibraryV1,
  exportedAt = new Date().toISOString(),
): LibraryExportV1 {
  const keys = new Set(Object.keys(library.annotations));
  library.favorites.people.forEach((id) => keys.add(entityKey("person", id)));
  library.favorites.works.forEach((id) => keys.add(entityKey("work", id)));

  const items = [...keys].flatMap((key): LibraryExportItem[] => {
    const separator = key.indexOf(":");
    const entityType = key.slice(0, separator);
    const entityId = key.slice(separator + 1);
    if ((entityType !== "person" && entityType !== "work") || !entityId) return [];
    const annotation = library.annotations[key] ?? { tags: [], note: "" };
    const favorites = entityType === "person" ? library.favorites.people : library.favorites.works;
    return [{ entityType, entityId, favorite: favorites.includes(entityId), ...annotation }];
  });

  return { format: "averia-local-library", version: 1, exportedAt, items };
}

export function parseLibraryExport(raw: string): LibraryExportV1 {
  const value = JSON.parse(raw) as Partial<LibraryExportV1>;
  if (
    value.format !== "averia-local-library" ||
    value.version !== 1 ||
    !Array.isArray(value.items)
  ) {
    throw new Error("文件不是受支持的 Averia 本地资料库格式。");
  }

  const items = value.items.map((item, index) => {
    if (
      !item ||
      (item.entityType !== "person" && item.entityType !== "work") ||
      typeof item.entityId !== "string" ||
      !item.entityId ||
      typeof item.favorite !== "boolean" ||
      !Array.isArray(item.tags) ||
      !item.tags.every((tag) => typeof tag === "string") ||
      typeof item.note !== "string"
    ) {
      throw new Error(`第 ${index + 1} 条资料格式不正确。`);
    }
    return { ...item, tags: stringArray(item.tags) };
  });

  return {
    format: "averia-local-library",
    version: 1,
    exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : "",
    items,
  };
}

export function mergeLibraryExport(current: LocalLibraryV1, imported: LibraryExportV1) {
  const next = structuredClone(current);
  imported.items.forEach((item) => {
    const kind = item.entityType === "person" ? "people" : "works";
    const favorites = next.favorites[kind].filter((id) => id !== item.entityId);
    next.favorites[kind] = item.favorite ? [...favorites, item.entityId] : favorites;
    next.annotations[entityKey(item.entityType, item.entityId)] = {
      tags: item.tags,
      note: item.note,
    };
  });
  return next;
}
