import { SkHeader, SkList, SkPage, SkSection } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} back />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-4">
          <SkSection fields={12} cols={3} />
          <SkSection fields={3} cols={2} />
        </div>
        <SkList items={6} />
      </div>
    </SkPage>
  );
}
