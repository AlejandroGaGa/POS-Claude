import { SkHeader, SkPage, SkSection, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} back />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <SkSection fields={3} cols={1} />
        <div className="rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5">
          <SkTable rows={5} cols={4} inCard />
        </div>
      </div>
    </SkPage>
  );
}
