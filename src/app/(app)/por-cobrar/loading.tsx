import { SkFilters, SkHeader, SkPage, SkStats, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} />
      <SkStats n={3} />
      <SkFilters fields={1} />
      <SkTable cols={7} />
    </SkPage>
  );
}
