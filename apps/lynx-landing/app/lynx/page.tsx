import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LynxLogo } from "@repo/ui/components/brands/lynx-logo";
import { Button } from "@repo/ui/components/ui/button";

const CONTACT_EMAIL = "partners@hvnn.me";
const CONTACT_HREF = `mailto:${CONTACT_EMAIL}`;
const HERO_SIGNAL_KEYS = ["timeline", "rootCause", "debugging"] as const;
const FEATURE_KEYS = [
  "timeline",
  "rootCause",
  "improve",
  "reliability",
] as const;
const AUDIENCE_KEYS = ["support", "toolAgents", "b2b"] as const;
const SNAPSHOT_STAT_KEYS = ["issues", "latency", "blocked"] as const;
const SNAPSHOT_TIMELINE_KEYS = [
  "userInput",
  "llmCall",
  "toolCall",
  "guardrail",
] as const;
const SNAPSHOT_DETAIL_KEYS = ["evidence", "nextAction", "policy"] as const;
const FLOW_KEYS = ["record", "inspect", "control"] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LynxLanding.metadata");

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LynxPage() {
  const t = await getTranslations("LynxLanding");

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-30"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_top,var(--surface),transparent_38rem)]"
          aria-hidden="true"
        />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link
            href="/lynx"
            className="inline-flex items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={t("header.homeAria")}
          >
            <LynxLogo className="size-7 text-foreground" aria-hidden="true" />
            <span>{t("productName")}</span>
          </Link>
          <Button asChild size="lg" className="h-11 px-4">
            <a href={CONTACT_HREF}>{t("header.cta")}</a>
          </Button>
        </header>

        <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-8 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[0.98fr_1.02fr] lg:items-center lg:pb-20 lg:pt-14">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
              <span
                className="size-1.5 rounded-full bg-primary"
                aria-hidden="true"
              />
              {t("hero.eyebrow")}
            </div>
            <h1 className="max-w-[42rem] text-4xl font-semibold leading-[1.12] tracking-normal [word-break:keep-all] sm:text-5xl lg:text-6xl">
              {t("hero.headline")}
            </h1>
            <p className="mt-5 max-w-[38rem] text-base leading-7 text-muted-foreground [word-break:keep-all] sm:text-lg">
              {t("hero.description")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-5">
                <a href={CONTACT_HREF}>{t("hero.primaryCta")}</a>
              </Button>
            </div>
            <p className="mt-4 max-w-[38rem] text-sm font-medium leading-6 text-muted-foreground [word-break:keep-all]">
              {t("hero.trustNote")}
            </p>
          </div>

          <ProductSnapshot t={t} />

          <div className="grid gap-3 sm:grid-cols-3 lg:col-span-2">
            {HERO_SIGNAL_KEYS.map((key) => (
              <article
                key={key}
                className="rounded-xl border border-border bg-background p-5 shadow-sm"
              >
                <h2 className="text-base font-semibold">
                  {t(`hero.signals.${key}.label`)}
                </h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground [word-break:keep-all]">
                  {t(`hero.signals.${key}.value`)}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <SectionBand>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <SectionHeading
            eyebrow={t("problem.eyebrow")}
            title={t("problem.title")}
          />
          <div className="space-y-4 text-base leading-7 text-muted-foreground">
            <p>{t("problem.body1")}</p>
            <p>{t("problem.body2")}</p>
          </div>
        </div>
      </SectionBand>

      <section className="mx-auto max-w-6xl px-5 py-14 sm:px-8 lg:py-20">
        <SectionHeading
          eyebrow={t("features.eyebrow")}
          title={t("features.title")}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {FEATURE_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-xl border border-border bg-card p-5"
            >
              <h3 className="text-lg font-semibold">
                {t(`features.cards.${key}.title`)}
              </h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {t(`features.cards.${key}.body`)}
              </p>
            </article>
          ))}
        </div>
      </section>

      <SectionBand>
        <div className="grid gap-6 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <SectionHeading eyebrow={t("flow.eyebrow")} title={t("flow.title")} />
          <div className="grid gap-3 sm:grid-cols-3">
            {FLOW_KEYS.map((key) => (
              <article
                key={key}
                className="rounded-xl border border-border bg-background p-5"
              >
                <h3 className="text-base font-semibold">
                  {t(`flow.steps.${key}.title`)}
                </h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground [word-break:keep-all]">
                  {t(`flow.steps.${key}.body`)}
                </p>
              </article>
            ))}
          </div>
        </div>
      </SectionBand>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-14 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:py-20">
        <div>
          <SectionHeading
            eyebrow={t("audience.eyebrow")}
            title={t("audience.title")}
          />
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {t("audience.body")}
          </p>
        </div>
        <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {AUDIENCE_KEYS.map((key) => (
            <div
              key={key}
              className="flex min-h-16 items-center rounded-xl border border-border bg-card px-5 py-4 text-sm font-medium"
            >
              {t(`audience.examples.${key}`)}
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-surface border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl rounded-2xl px-6 py-10 text-center sm:px-10 lg:px-14 lg:py-14">
            <div className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-muted-foreground">
              {t("finalCta.badge")}
            </div>
            <h2 className="mx-auto mt-5 max-w-3xl text-3xl font-semibold leading-tight [word-break:keep-all] sm:text-4xl">
              {t("finalCta.title")}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground [word-break:keep-all]">
              {t("finalCta.body")}
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground [word-break:keep-all]">
              {t("finalCta.note")}
            </p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button asChild size="lg" className="h-12 px-5">
                <a href={CONTACT_HREF}>{t("finalCta.button")}</a>
              </Button>
              <a
                href={CONTACT_HREF}
                className="rounded-md text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t("finalCta.email")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SectionBand({ children }: { children: React.ReactNode }) {
  return (
    <section className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:py-14">
        {children}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-normal [word-break:keep-all] sm:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function ProductSnapshot({
  t,
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <div
      className="w-full rounded-2xl border border-border bg-surface p-3 shadow-sm sm:p-4 lg:ml-auto"
      aria-label={t("preview.ariaLabel")}
    >
      {/* TODO: Replace this token-based product snapshot with real Lynx screenshots when available. */}
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {t("preview.snapshotTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("preview.snapshotSubtitle")}
            </p>
          </div>
          <span className="ml-3 shrink-0 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {t("preview.liveBadge")}
          </span>
        </div>

        <div className="grid gap-3 p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {SNAPSHOT_STAT_KEYS.map((key) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <p className="text-xs text-muted-foreground">
                  {t(`preview.stats.${key}.label`)}
                </p>
                <p className="mt-2 text-2xl font-semibold leading-none">
                  {t(`preview.stats.${key}.value`)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 xl:grid-cols-[1fr_16rem]">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <PreviewTitle>{t("preview.timeline")}</PreviewTitle>
                <span className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {t("preview.timelineBadge")}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {SNAPSHOT_TIMELINE_KEYS.map((key, index) => (
                  <div
                    key={key}
                    className="grid grid-cols-[auto_1fr_auto] gap-3"
                  >
                    <div className="flex flex-col items-center">
                      <span className="mt-1 size-2 rounded-full bg-primary" />
                      {index < SNAPSHOT_TIMELINE_KEYS.length - 1 ? (
                        <span className="mt-2 h-9 w-px bg-border" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {t(`preview.timelineItems.${key}.title`)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {t(`preview.timelineItems.${key}.body`)}
                      </p>
                    </div>
                    <span className="hidden text-xs text-muted-foreground sm:block">
                      {t(`preview.timelineItems.${key}.time`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4">
              <PreviewTitle>{t("preview.detail.title")}</PreviewTitle>
              <p className="mt-3 text-sm leading-6 [word-break:keep-all]">
                {t("preview.detail.body")}
              </p>
              <div className="mt-4 grid gap-2">
                {SNAPSHOT_DETAIL_KEYS.map((key) => (
                  <div
                    key={key}
                    className="rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      {t(`preview.detail.${key}.label`)}
                    </p>
                    <p className="mt-1 truncate text-sm">
                      {t(`preview.detail.${key}.value`)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}
