import type { DemoPerson, DemoWork } from "@/data/demo";

export type CatalogPerson = DemoPerson;
export type CatalogWork = DemoWork;

export type PersonRecord = {
  person: CatalogPerson;
  relatedWorks: CatalogWork[];
};

export type WorkRecord = {
  work: CatalogWork;
  cast: CatalogPerson[];
};

export interface CatalogRepository {
  listPeople(): Promise<CatalogPerson[]>;
  listWorks(): Promise<CatalogWork[]>;
  findPersonBySlug(slug: string): Promise<PersonRecord | null>;
  findWorkBySlug(slug: string): Promise<WorkRecord | null>;
}
