import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// 数据库只保存明确的状态，不使用空字符串表达“未知”。
export const publicationStatus = pgEnum("publication_status", [
  "draft",
  "review",
  "published",
  "hidden",
]);
export const confidenceLevel = pgEnum("confidence_level", [
  "unverified",
  "low",
  "medium",
  "high",
  "confirmed",
]);
export const careerEventType = pgEnum("career_event_type", [
  "debut",
  "retirement",
  "comeback",
  "hiatus",
  "other",
]);
export const organizationType = pgEnum("organization_type", [
  "agency",
  "maker",
  "label",
  "studio",
  "distributor",
]);
export const sourceRole = pgEnum("source_role", [
  "authoritative",
  "reference",
  "community",
  "manual",
]);
export const resolutionStatus = pgEnum("resolution_status", ["pending", "accepted", "rejected"]);
export const mediaKind = pgEnum("media_kind", ["portrait", "cover", "still"]);
export const rightsStatus = pgEnum("rights_status", [
  "unknown",
  "link_only",
  "licensed",
  "removed",
]);

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    primaryName: text("primary_name").notNull(),
    nameJa: text("name_ja"),
    nameZh: text("name_zh"),
    nameEn: text("name_en"),
    biography: text("biography"),
    birthDate: date("birth_date"),
    birthDatePrecision: text("birth_date_precision"),
    birthplace: text("birthplace"),
    heightCm: integer("height_cm"),
    measurements: jsonb("measurements").$type<{
      bust?: number;
      waist?: number;
      hip?: number;
      cup?: string;
    }>(),
    bloodType: text("blood_type"),
    interests: text("interests").array(),
    active: boolean("active"),
    status: publicationStatus("status").notNull().default("draft"),
    confidence: confidenceLevel("confidence").notNull().default("unverified"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("people_slug_unique").on(table.slug),
    index("people_primary_name_idx").on(table.primaryName),
  ],
);

export const personAliases = pgTable(
  "person_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    language: text("language"),
    validFrom: date("valid_from"),
    validTo: date("valid_to"),
    isPrimary: boolean("is_primary").notNull().default(false),
    ...auditColumns,
  },
  (table) => [
    index("person_aliases_person_idx").on(table.personId),
    index("person_aliases_name_idx").on(table.name),
  ],
);

export const careerEvents = pgTable("career_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  type: careerEventType("type").notNull(),
  eventDate: date("event_date"),
  datePrecision: text("date_precision"),
  note: text("note"),
  ...auditColumns,
});

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    type: organizationType("type").notNull(),
    name: text("name").notNull(),
    nameJa: text("name_ja"),
    nameZh: text("name_zh"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("organizations_slug_unique").on(table.slug)],
);

export const affiliations = pgTable("affiliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  ...auditColumns,
});

export const works = pgTable(
  "works",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    titleOriginal: text("title_original").notNull(),
    titleZh: text("title_zh"),
    titleEn: text("title_en"),
    synopsis: text("synopsis"),
    status: publicationStatus("status").notNull().default("draft"),
    confidence: confidenceLevel("confidence").notNull().default("unverified"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("works_slug_unique").on(table.slug),
    index("works_title_idx").on(table.titleOriginal),
  ],
);

// “作品”与“发行版本”分离：番号、介质和发行日期属于发行版本。
export const releases = pgTable(
  "releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    releaseDate: date("release_date"),
    runtimeMinutes: integer("runtime_minutes"),
    medium: text("medium"),
    distributorId: uuid("distributor_id").references(() => organizations.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("releases_code_unique").on(table.code),
    index("releases_work_idx").on(table.workId),
  ],
);

export const credits = pgTable(
  "credits",
  {
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id),
    creditedAs: text("credited_as"),
    creditType: text("credit_type").notNull().default("performer"),
    billingOrder: integer("billing_order"),
    ...auditColumns,
  },
  (table) => [primaryKey({ columns: [table.workId, table.personId, table.creditType] })],
);

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    originalName: text("original_name"),
    parentId: uuid("parent_id"),
    deprecatedById: uuid("deprecated_by_id"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const workTags = pgTable(
  "work_tags",
  {
    workId: uuid("work_id")
      .notNull()
      .references(() => works.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id),
    ...auditColumns,
  },
  (table) => [primaryKey({ columns: [table.workId, table.tagId] })],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    role: sourceRole("role").notNull(),
    baseUrl: text("base_url"),
    termsUrl: text("terms_url"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("sources_name_unique").on(table.name)],
);

// Observation 保存“某来源声称了什么”，不会直接覆盖已发布字段。
export const observations = pgTable(
  "observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    sourceUrl: text("source_url").notNull(),
    fieldPath: text("field_path").notNull(),
    observedValue: jsonb("observed_value").notNull(),
    contentHash: text("content_hash"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    ...auditColumns,
  },
  (table) => [index("observations_entity_idx").on(table.entityType, table.entityId)],
);

export const resolutions = pgTable("resolutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  fieldPath: text("field_path").notNull(),
  status: resolutionStatus("status").notNull().default("pending"),
  chosenObservationId: uuid("chosen_observation_id").references(() => observations.id),
  rationale: text("rationale"),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  ...auditColumns,
});

export const mediaAssets = pgTable("media_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: mediaKind("kind").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  rights: rightsStatus("rights").notNull().default("unknown"),
  hostedUrl: text("hosted_url"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  hidden: boolean("hidden").notNull().default(false),
  ...auditColumns,
});

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  evidenceUrl: text("evidence_url"),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  safetyCritical: boolean("safety_critical").notNull().default(false),
  ...auditColumns,
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  detail: jsonb("detail").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
