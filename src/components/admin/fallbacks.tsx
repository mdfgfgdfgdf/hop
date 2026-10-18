import { Page, PageHeader, TableSkeleton } from "./ui";

/** Suspense fallback for list screens that read search params. */
export function ListFallback({ title }: { title: string }) {
  return (
    <Page>
      <PageHeader title={title} />
      <div className="card overflow-hidden">
        <TableSkeleton rows={8} />
      </div>
    </Page>
  );
}
