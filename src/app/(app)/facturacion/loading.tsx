import { SkFilters, SkHeader, SkPage, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader />
      <SkFilters fields={1} />
      <SkTable cols={6} />
    </SkPage>
  );
}
