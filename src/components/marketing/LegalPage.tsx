import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

export const LEGAL_LAST_UPDATED = "November 2026";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Readable long-form layout for legal documents, with a table of contents. */
export function LegalPage({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: React.ReactNode;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-full flex-1 bg-zinc-950 text-zinc-100 antialiased">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-16 sm:px-6 sm:pt-20">
        <p className="text-sm text-zinc-500" data-testid="last-updated">
          Last updated: {LEGAL_LAST_UPDATED}
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
        <div className="mt-6 text-[15px] leading-7 text-zinc-300">{intro}</div>

        <nav aria-label="On this page" className="mt-10 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">On this page</p>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-zinc-400 transition-colors hover:text-white">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-12 space-y-12">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24">
              <h2 id={`${s.id}-h`} className="text-xl font-semibold tracking-tight text-white">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-7 text-zinc-300 [&_a]:text-white [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
