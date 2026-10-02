import { SkHeader, SkPage, SkTable } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader back />
      <SkTable cols={6} />
    </SkPage>
  );
}
