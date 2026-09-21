import "dotenv/config";

import { createDatabase } from "./client";
import { people, personAliases, releases, works } from "./schema";

const connection = createDatabase();

try {
  const [person] = await connection.db
    .insert(people)
    .values({
      slug: "haruka-amami",
      primaryName: "天海遥",
      nameJa: "天海はるか",
      nameZh: "天海遥",
      status: "published",
      confidence: "confirmed",
      active: true,
    })
    .onConflictDoNothing()
    .returning({ id: people.id });

  if (person) {
    await connection.db
      .insert(personAliases)
      .values({ personId: person.id, name: "Haruka Amami", language: "en" });
  }

  const [work] = await connection.db
    .insert(works)
    .values({
      slug: "paper-moon-01",
      titleOriginal: "紙月の記録",
      titleZh: "纸月的记录",
      status: "published",
      confidence: "high",
    })
    .onConflictDoNothing()
    .returning({ id: works.id });

  if (work) {
    await connection.db
      .insert(releases)
      .values({ workId: work.id, code: "DEMO-001", medium: "digital", runtimeMinutes: 128 });
  }

  console.log("虚构种子数据写入完成。");
} finally {
  await connection.close();
}
