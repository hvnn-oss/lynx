import { PromptDetailScreen } from "@/components/screen/prompts/operations";

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-full p-5">
      <PromptDetailScreen promptId={id} />
    </main>
  );
}
