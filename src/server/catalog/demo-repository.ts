import "server-only";

import { demoPeople, demoWorks } from "@/data/demo";
import type { CatalogRepository } from "./types";

export const demoCatalogRepository: CatalogRepository = {
  async listPeople() {
    return demoPeople;
  },
  async listWorks() {
    return demoWorks;
  },
  async findPersonBySlug(slug) {
    const person = demoPeople.find((item) => item.slug === slug);
    if (!person) return null;
    return {
      person,
      relatedWorks: demoWorks.filter((work) => work.cast.includes(person.name)),
    };
  },
  async findWorkBySlug(slug) {
    const work = demoWorks.find((item) => item.slug === slug);
    if (!work) return null;
    return {
      work,
      cast: work.cast.flatMap((name) => {
        const person = demoPeople.find((item) => item.name === name);
        return person ? [person] : [];
      }),
    };
  },
};
