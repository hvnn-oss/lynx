import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations("home");

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 px-6 py-16">
      <section className="w-full max-w-2xl rounded-lg border bg-background p-8">
        <p className="text-sm font-medium text-muted-foreground">Lynx Protect</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
          {t("description")}
        </p>
      </section>
    </main>
  );
}
