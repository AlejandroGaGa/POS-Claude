import { Sk, SkFilters, SkHeader, SkList, SkPage, SkStats } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkFilters fields={0} dates />
      <Sk className="h-32 rounded-3xl" />
      <SkStats n={4} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <div className="flex h-72 items-end gap-1.5 rounded-3xl bg-surface p-5 shadow-[var(--surface-shadow)]">
            {Array.from({ length: 30 }, (_, i) => (
              <Sk key={i} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${20 + ((i * 37) % 70)}%` }} />
            ))}
          </div>
          <SkList items={5} />
        </div>
        <SkList items={4} />
      </div>
    </SkPage>
  );
}
