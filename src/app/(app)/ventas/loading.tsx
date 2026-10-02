import { SkFilters, SkHeader, SkPage, SkStats, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkFilters fields={4} dates />
      <SkStats n={5} />
      <SkTable cols={6} />
    </SkPage>
  );
}
