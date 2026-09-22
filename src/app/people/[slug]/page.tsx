import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelatedWorks } from "@/components/related-works";
import { LocalEntityNotes } from "@/components/local-entity-notes";
import { demoPeople } from "@/data/demo";
import { getCatalogRepository } from "@/server/catalog/repository";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return demoPeople.map((person) => ({ slug: person.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const repository = await getCatalogRepository();
  const record = await repository.findPersonBySlug(slug);
  return { title: record ? `${record.person.name} · Averia` : "人物不存在 · Averia" };
}

export default async function PersonDetailPage({ params }: Props) {
  const { slug } = await params;
  const repository = await getCatalogRepository();
  const record = await repository.findPersonBySlug(slug);
  if (!record) notFound();
  const { person, relatedWorks } = record;
  return (
    <main className="route-page detail-page">
      <Link className="back-link" href="/people">
        ← 返回人物目录
      </Link>
      <section className="person-hero">
        <div className={`portrait tone-${person.tone}`}>
          <span className="portrait-initials">{person.initials}</span>
        </div>
        <div>
          <span className={`status status-${person.status === "活跃" ? "active" : "quiet"}`}>
            {person.status}
          </span>
          <h1>{person.name}</h1>
          <p className="original-heading">
            {person.originalName} · {person.romanizedName}
          </p>
          <p className="detail-lead">{person.biography}</p>
          <dl className="detail-facts">
            <div>
              <dt>出道年份</dt>
              <dd>{person.debutYear}</dd>
            </div>
            <div>
              <dt>作品数量</dt>
              <dd>{person.workCount}</dd>
            </div>
            <div>
              <dt>资料可信度</dt>
              <dd>{person.status === "资料待确认" ? "待审核" : "已确认"}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="detail-columns">
        <article>
          <span className="section-number">ALIASES</span>
          <h2>姓名与别名</h2>
          <div className="alias-list">
            {person.aliases.map((alias) => (
              <span key={alias}>{alias}</span>
            ))}
          </div>
        </article>
        <article>
          <span className="section-number">TIMELINE</span>
          <h2>职业时间线</h2>
          <ol className="timeline">
            {person.timeline.map((event) => (
              <li key={`${event.year}-${event.label}`}>
                <time>{event.year}</time>
                <div>
                  <strong>{event.label}</strong>
                  <p>{event.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </article>
      </section>
      <RelatedWorks works={relatedWorks} />
      <LocalEntityNotes entityType="person" entityId={person.id} name={person.name} />
    </main>
  );
}
