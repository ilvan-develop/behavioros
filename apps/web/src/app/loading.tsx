import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden w-64 border-r border-border bg-background lg:block" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {['a', 'b', 'c', 'd'].map((k) => (
                <Skeleton key={`loading-skeleton-${k}`} className="h-28 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-7">
              <Skeleton className="lg:col-span-4 h-64 rounded-xl" />
              <Skeleton className="lg:col-span-3 h-64 rounded-xl" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
