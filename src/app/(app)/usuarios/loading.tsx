import { SkHeader, SkPage, SkSection, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <SkSection fields={4} cols={1} />
        <div className="rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5">
          <SkTable rows={4} cols={4} inCard />
        </div>
      </div>
    </SkPage>
  );
}
