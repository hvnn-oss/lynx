import { CreateWorkspaceForm } from "@/components/screen/workspace/create-workspace-form";
import { useTranslations } from "next-intl";

export default function CreateWorkspacePage() {
  const t = useTranslations("workspace.create");

  return (
    <main className="mx-auto min-h-full max-w-2xl p-5">
      <div>
        <div className="mb-6">
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <CreateWorkspaceForm />
      </div>
    </main>
  );
}
