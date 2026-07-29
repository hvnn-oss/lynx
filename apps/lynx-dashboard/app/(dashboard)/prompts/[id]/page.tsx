import { PromptEditorScreen } from "@/components/screen/prompts/prompt-editor-screen";

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-full p-5">
      <PromptEditorScreen promptId={id} />
    </main>
  );
}
