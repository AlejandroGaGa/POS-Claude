import { SkFilters, SkHeader, SkList, SkPage, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={4} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SkList items={5} />
        <SkList items={2} />
        <SkList items={4} className="md:col-span-2 xl:col-span-1" />
      </div>
      <SkFilters fields={3} />
      <SkTable cols={5} />
    </SkPage>
  );
}
