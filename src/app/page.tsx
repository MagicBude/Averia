import { HomePrototype } from "@/components/home-prototype";
import { getCatalogRepository } from "@/server/catalog/repository";

export default async function HomePage() {
  const repository = await getCatalogRepository();
  const [people, works] = await Promise.all([repository.listPeople(), repository.listWorks()]);
  return <HomePrototype people={people} works={works} />;
}
