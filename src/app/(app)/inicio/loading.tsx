import { Sk, SkHeader, SkPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkPage>
      <SkHeader actions={0} />
      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex min-h-48 flex-col gap-6 rounded-[2rem] bg-surface p-6 shadow-[var(--surface-shadow)] sm:min-h-60 sm:p-7 xl:min-h-[19rem] xl:p-8">
            <Sk className="size-16 rounded-2xl sm:size-20 sm:rounded-3xl" />
            <div className="mt-auto flex flex-col gap-2">
              <Sk className="h-7 w-44" />
              <Sk className="h-4 w-56 max-w-full" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-3xl bg-surface p-4 shadow-[var(--surface-shadow)] sm:p-5">
            <Sk className="size-12 rounded-2xl" />
            <div className="flex flex-1 flex-col gap-2">
              <Sk className="h-3.5 w-24" />
              <Sk className="h-6 w-28" />
            </div>
          </div>
        ))}
      </div>
    </SkPage>
  );
}
