import { SkFilters, SkHeader, SkPage, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={4} />
      <SkFilters fields={3} />
      <SkTable rows={10} cols={5} />
    </SkPage>
  );
}
