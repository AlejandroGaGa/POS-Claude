import { SkHeader, SkPage, SkSection } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkSection fields={5} cols={2} />
        <div className="flex flex-col gap-4">
          <SkSection fields={2} cols={2} />
          <SkSection fields={1} cols={1} />
        </div>
      </div>
    </SkPage>
  );
}
