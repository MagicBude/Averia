import { loadDatabaseEnvironment } from "./load-env";

import { inArray } from "drizzle-orm";

import { demoPeople, demoWorks } from "../data/demo";
import { createDatabase } from "./client";
import {
  careerEvents,
  credits,
  organizations,
  people,
  personAliases,
  releases,
  works,
} from "./schema";

loadDatabaseEnvironment();

function seedId(namespace: "8000" | "8100" | "8200" | "8300", index: number) {
  return `00000000-0000-4000-${namespace}-${String(index + 1).padStart(12, "0")}`;
}

function careerType(label: string): "debut" | "retirement" | "comeback" | "other" {
  if (label === "出道") return "debut";
  if (label === "引退") return "retirement";
  if (label === "复出") return "comeback";
  return "other";
}

const connection = createDatabase();

try {
  await connection.db.transaction(async (transaction) => {
    await transaction
      .insert(people)
      .values(
        demoPeople.map((person, index) => ({
          id: seedId("8000", index),
          slug: person.slug,
          primaryName: person.name,
          nameJa: person.originalName,
          nameZh: person.name,
          nameEn: person.romanizedName,
          biography: person.biography,
          status: "published" as const,
          confidence: person.status === "资料待确认" ? ("medium" as const) : ("confirmed" as const),
          active: person.status === "活跃" ? true : person.status === "引退" ? false : null,
        })),
      )
      .onConflictDoUpdate({
        target: people.slug,
        set: { status: "published", updatedAt: new Date() },
      });
    const persistedPeople = await transaction
      .select({ id: people.id, slug: people.slug })
      .from(people)
      .where(
        inArray(
          people.slug,
          demoPeople.map((person) => person.slug),
        ),
      );
    const personIdBySlug = new Map(persistedPeople.map((person) => [person.slug, person.id]));
    const personIds = demoPeople.map((person) => personIdBySlug.get(person.slug)!);

    await transaction
      .insert(organizations)
      .values(
        demoWorks.map((work, index) => ({
          id: seedId("8200", index),
          slug: `demo-maker-${index + 1}`,
          type: "maker" as const,
          name: work.maker,
          nameZh: work.maker,
        })),
      )
      .onConflictDoUpdate({ target: organizations.slug, set: { updatedAt: new Date() } });
    const persistedOrganizations = await transaction
      .select({ id: organizations.id, slug: organizations.slug })
      .from(organizations)
      .where(
        inArray(
          organizations.slug,
          demoWorks.map((_, index) => `demo-maker-${index + 1}`),
        ),
      );
    const organizationIdBySlug = new Map(
      persistedOrganizations.map((item) => [item.slug, item.id]),
    );
    const organizationIds = demoWorks.map((_, index) =>
      organizationIdBySlug.get(`demo-maker-${index + 1}`)!,
    );

    await transaction
      .insert(works)
      .values(
        demoWorks.map((work, index) => ({
          id: seedId("8100", index),
          slug: work.slug,
          titleOriginal: work.originalTitle,
          titleZh: work.title,
          synopsis: work.synopsis,
          status: "published" as const,
          confidence: "confirmed" as const,
        })),
      )
      .onConflictDoUpdate({
        target: works.slug,
        set: { status: "published", updatedAt: new Date() },
      });
    const persistedWorks = await transaction
      .select({ id: works.id, slug: works.slug })
      .from(works)
      .where(
        inArray(
          works.slug,
          demoWorks.map((work) => work.slug),
        ),
      );
    const workIdBySlug = new Map(persistedWorks.map((work) => [work.slug, work.id]));
    const workIds = demoWorks.map((work) => workIdBySlug.get(work.slug)!);

    await transaction.delete(personAliases).where(inArray(personAliases.personId, personIds));
    await transaction.insert(personAliases).values(
      demoPeople.flatMap((person, index) =>
        person.aliases.map((alias) => ({
          personId: personIds[index]!,
          name: alias,
          language: /^[\x00-\x7F]+$/.test(alias) ? "en" : "ja",
        })),
      ),
    );

    await transaction.delete(careerEvents).where(inArray(careerEvents.personId, personIds));
    await transaction.insert(careerEvents).values(
      demoPeople.flatMap((person, index) =>
        person.timeline.map((event) => ({
          personId: personIds[index]!,
          type: careerType(event.label),
          eventDate: `${event.year}-01-01`,
          datePrecision: "year",
          note: event.detail,
        })),
      ),
    );

    await transaction.delete(releases).where(
      inArray(
        releases.code,
        demoWorks.map((work) => work.code),
      ),
    );
    await transaction.insert(releases).values(
      demoWorks.map((work, index) => ({
        id: seedId("8300", index),
        workId: workIds[index]!,
        code: work.code,
        releaseDate: work.releaseDate,
        runtimeMinutes: work.runtimeMinutes,
        medium: work.tags.includes("实体发行") ? "physical" : "digital",
        distributorId: organizationIds[index]!,
      })),
    );

    await transaction.delete(credits).where(inArray(credits.workId, workIds));
    const creditValues = demoWorks.flatMap((work, workIndex) =>
      work.cast.flatMap((name, billingOrder) => {
        const personIndex = demoPeople.findIndex((person) => person.name === name);
        if (personIndex < 0) return [];
        return [
          {
            workId: workIds[workIndex]!,
            personId: personIds[personIndex]!,
            creditedAs: name,
            billingOrder: billingOrder + 1,
          },
        ];
      }),
    );
    if (creditValues.length) await transaction.insert(credits).values(creditValues);
  });

  console.log(`虚构种子数据写入完成：${demoPeople.length} 位人物，${demoWorks.length} 部作品。`);
} finally {
  await connection.close();
}
