"use client";

import { useLocalLibrary } from "@/hooks/use-local-library";
import { entityKey, type EntityType } from "@/lib/local-library";
import { BookmarkIcon } from "./icons";

type Props = {
  entityType: EntityType;
  entityId: string;
  name: string;
};

export function LocalEntityNotes({ entityType, entityId, name }: Props) {
  const { library, toggleFavorite, updateAnnotation } = useLocalLibrary();
  const kind = entityType === "person" ? "people" : "works";
  const favorite = library.favorites[kind].includes(entityId);
  const annotation = library.annotations[entityKey(entityType, entityId)] ?? {
    tags: [],
    note: "",
  };

  return (
    <section className="local-notes" aria-labelledby="local-notes-title">
      <div className="local-notes-heading">
        <div>
          <span className="section-number">PRIVATE · LOCAL ONLY</span>
          <h2 id="local-notes-title">我的本地资料</h2>
        </div>
        <button
          className={favorite ? "local-favorite is-active" : "local-favorite"}
          type="button"
          aria-pressed={favorite}
          onClick={() => toggleFavorite(kind, entityId)}
        >
          <BookmarkIcon />
          {favorite ? "已收藏" : `收藏${entityType === "person" ? "人物" : "作品"}`}
        </button>
      </div>
      <p>标签和备注只保存在当前浏览器，不会上传、公开或进入分享链接。</p>
      <div className="local-notes-fields">
        <label>
          <span>私有标签</span>
          <input
            key={`tags-${annotation.tags.join(",")}`}
            defaultValue={annotation.tags.join("，")}
            placeholder="例如：稍后查看，资料完整"
            onBlur={(event) =>
              updateAnnotation(entityType, entityId, {
                ...annotation,
                tags: event.currentTarget.value
                  .split(/[,，]/)
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>
        <label>
          <span>私人备注</span>
          <textarea
            key={`note-${annotation.note}`}
            defaultValue={annotation.note}
            placeholder={`记录关于“${name}”的私人备注…`}
            onBlur={(event) =>
              updateAnnotation(entityType, entityId, {
                ...annotation,
                note: event.currentTarget.value,
              })
            }
          />
        </label>
      </div>
    </section>
  );
}
