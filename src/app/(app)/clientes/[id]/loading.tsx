import { SkHeader, SkList, SkPage, SkStats, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={3} back />
      <SkStats n={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <SkTable rows={5} cols={5} />
        </div>
        <div className="flex flex-col gap-4">
          <SkList items={4} />
          <SkList items={2} />
        </div>
      </div>
    </SkPage>
  );
}
