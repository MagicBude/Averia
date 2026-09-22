import "server-only";

import { asc, eq, inArray } from "drizzle-orm";

import { createDatabase } from "@/db/client";
import {
  careerEvents,
  credits,
  organizations,
  people,
  personAliases,
  releases,
  works,
} from "@/db/schema";
import type { CatalogPerson, CatalogRepository, CatalogWork } from "./types";

const personTones = ["coral", "sage", "ink", "gold"];
const workTones = ["moon", "afternoon", "coast", "garden"];

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AV"
  );
}

async function loadCatalog() {
  const connection = createDatabase();
  try {
    const personRows = await connection.db
      .select()
      .from(people)
      .where(eq(people.status, "published"))
      .orderBy(asc(people.primaryName));
    const workRows = await connection.db
      .select()
      .from(works)
      .where(eq(works.status, "published"))
      .orderBy(asc(works.titleOriginal));
    const personIds = personRows.map((item) => item.id);
    const workIds = workRows.map((item) => item.id);

    const [aliasRows, eventRows, creditRows, releaseRows, organizationRows] = await Promise.all([
      personIds.length
        ? connection.db
            .select()
            .from(personAliases)
            .where(inArray(personAliases.personId, personIds))
        : [],
      personIds.length
        ? connection.db.select().from(careerEvents).where(inArray(careerEvents.personId, personIds))
        : [],
      workIds.length
        ? connection.db.select().from(credits).where(inArray(credits.workId, workIds))
        : [],
      workIds.length
        ? connection.db.select().from(releases).where(inArray(releases.workId, workIds))
        : [],
      connection.db.select().from(organizations),
    ]);

    const namesByPersonId = new Map(personRows.map((person) => [person.id, person.primaryName]));
    const organizationById = new Map(
      organizationRows.map((organization) => [
        organization.id,
        organization.nameZh ?? organization.name,
      ]),
    );
    const creditsByWork = new Map<string, typeof creditRows>();
    creditRows.forEach((credit) =>
      creditsByWork.set(credit.workId, [...(creditsByWork.get(credit.workId) ?? []), credit]),
    );

    const catalogWorks: CatalogWork[] = workRows.flatMap((work, index) => {
      const release = releaseRows
        .filter((item) => item.workId === work.id)
        .sort((left, right) => (right.releaseDate ?? "").localeCompare(left.releaseDate ?? ""))[0];
      if (!release) return [];
      const cast = (creditsByWork.get(work.id) ?? [])
        .sort((left, right) => (left.billingOrder ?? 999) - (right.billingOrder ?? 999))
        .flatMap((credit) => namesByPersonId.get(credit.personId) ?? []);
      const releaseDate = release.releaseDate ?? "1900-01-01";
      return [
        {
          id: work.id,
          slug: work.slug,
          code: release.code,
          title: work.titleZh ?? work.titleOriginal,
          originalTitle: work.titleOriginal,
          releaseDate,
          releaseYear: Number(releaseDate.slice(0, 4)),
          maker: release.distributorId
            ? (organizationById.get(release.distributorId) ?? "发行方待确认")
            : "发行方待确认",
          cast,
          tone: workTones[index % workTones.length] ?? "moon",
          runtimeMinutes: release.runtimeMinutes ?? 0,
          tags: [release.medium ?? "介质待确认"],
          synopsis: work.synopsis ?? "暂无公开简介。",
        },
      ];
    });

    const workCountByPerson = new Map<string, number>();
    creditRows.forEach((credit) =>
      workCountByPerson.set(credit.personId, (workCountByPerson.get(credit.personId) ?? 0) + 1),
    );
    const catalogPeople: CatalogPerson[] = personRows.map((person, index) => {
      const aliases = aliasRows
        .filter((alias) => alias.personId === person.id)
        .map((alias) => alias.name);
      const timeline = eventRows
        .filter((event) => event.personId === person.id)
        .map((event) => ({
          year: Number(event.eventDate?.slice(0, 4) ?? person.createdAt.getFullYear()),
          label:
            event.type === "debut"
              ? "出道"
              : event.type === "retirement"
                ? "引退"
                : event.type === "comeback"
                  ? "复出"
                  : "职业记录",
          detail: event.note ?? "公开职业活动记录",
        }))
        .sort((left, right) => left.year - right.year);
      const debutYear =
        timeline.find((event) => event.label === "出道")?.year ?? person.createdAt.getFullYear();
      const romanizedName =
        aliases.find((alias) => /^[\x00-\x7F]+$/.test(alias)) ??
        person.nameEn ??
        person.primaryName;
      return {
        id: person.id,
        slug: person.slug,
        name: person.nameZh ?? person.primaryName,
        originalName: person.nameJa ?? person.primaryName,
        romanizedName,
        status: person.active === true ? "活跃" : person.active === false ? "引退" : "资料待确认",
        debutYear,
        workCount: workCountByPerson.get(person.id) ?? 0,
        initials: initials(romanizedName),
        tone: personTones[index % personTones.length] ?? "coral",
        aliases,
        biography: person.biography ?? "暂无公开简介。",
        timeline,
      };
    });

    return { people: catalogPeople, works: catalogWorks };
  } finally {
    await connection.close();
  }
}

export const postgresCatalogRepository: CatalogRepository = {
  async listPeople() {
    return (await loadCatalog()).people;
  },
  async listWorks() {
    return (await loadCatalog()).works;
  },
  async findPersonBySlug(slug) {
    const catalog = await loadCatalog();
    const person = catalog.people.find((item) => item.slug === slug);
    if (!person) return null;
    return {
      person,
      relatedWorks: catalog.works.filter((work) => work.cast.includes(person.name)),
    };
  },
  async findWorkBySlug(slug) {
    const catalog = await loadCatalog();
    const work = catalog.works.find((item) => item.slug === slug);
    if (!work) return null;
    return { work, cast: catalog.people.filter((person) => work.cast.includes(person.name)) };
  },
};
