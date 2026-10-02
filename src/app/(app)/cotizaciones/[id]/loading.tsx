import { SkHeader, SkList, SkPage, SkSection } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={3} back />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <SkList items={4} />
        <SkSection fields={2} cols={1} />
      </div>
    </SkPage>
  );
}
