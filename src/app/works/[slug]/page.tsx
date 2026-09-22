import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalEntityNotes } from "@/components/local-entity-notes";
import { demoPeople, demoWorks } from "@/data/demo";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return demoWorks.map((work) => ({ slug: work.slug }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const work = demoWorks.find((item) => item.slug === slug);
  return { title: work ? `${work.title} · Averia` : "作品不存在 · Averia" };
}

export default async function WorkDetailPage({ params }: Props) {
  const { slug } = await params;
  const work = demoWorks.find((item) => item.slug === slug);
  if (!work) notFound();
  const cast = work.cast
    .map((name) => demoPeople.find((person) => person.name === name))
    .filter((person) => person !== undefined);
  return (
    <main className="route-page detail-page">
      <Link className="back-link" href="/works">
        ← 返回作品索引
      </Link>
      <section className="work-detail-hero">
        <div className={`work-cover poster-${work.tone}`}>
          <span>
            AVERIA
            <br />
            ARCHIVE
          </span>
          <small>{work.code}</small>
        </div>
        <div>
          <span className="work-code">{work.code}</span>
          <h1>{work.title}</h1>
          <p className="original-heading">{work.originalTitle}</p>
          <p className="detail-lead">{work.synopsis}</p>
          <dl className="detail-facts">
            <div>
              <dt>发行年份</dt>
              <dd>{work.releaseYear}</dd>
            </div>
            <div>
              <dt>时长</dt>
              <dd>{work.runtimeMinutes} 分钟</dd>
            </div>
            <div>
              <dt>制作方</dt>
              <dd>{work.maker}</dd>
            </div>
          </dl>
          <div className="tag-list">
            {work.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </section>
      <section className="related-section">
        <span className="section-number">CAST</span>
        <h2>出演人物</h2>
        <div className="related-links">
          {cast.map((person) => (
            <Link href={`/people/${person.slug}`} key={person.id}>
              <span className={`avatar tone-${person.tone}`}>{person.initials}</span>
              <strong>{person.name}</strong>
              <small>{person.originalName}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="release-panel">
        <span className="section-number">RELEASE</span>
        <h2>发行版本</h2>
        <dl>
          <div>
            <dt>编号</dt>
            <dd>{work.code}</dd>
          </div>
          <div>
            <dt>介质</dt>
            <dd>{work.tags.includes("实体发行") ? "实体" : "数字"}</dd>
          </div>
          <div>
            <dt>权利状态</dt>
            <dd>虚构演示资料</dd>
          </div>
        </dl>
      </section>
      <LocalEntityNotes entityType="work" entityId={work.id} name={work.title} />
    </main>
  );
}
