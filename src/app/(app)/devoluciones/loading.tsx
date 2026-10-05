import { SkFilters, SkHeader, SkPage, SkStats, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkFilters fields={2} dates />
      <SkStats n={4} />
      <SkTable cols={6} />
    </SkPage>
  );
}
