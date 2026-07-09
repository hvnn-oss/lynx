import { IssueDetailOperationsScreen } from "@/components/screen/issues/operations";

export default async function IssueItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="min-h-full p-5">
      <IssueDetailOperationsScreen issueId={id} />
    </main>
  );
}
