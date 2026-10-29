import Skeleton from '@/components/ui/Skeleton'

const Card = ({ className, children }) => (
  <div className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 ${className ?? ''}`}>
    {children}
  </div>
)

/** Placeholder with the same layout as the dashboard, so nothing jumps when data arrives. */
export default function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-32" />
            <Skeleton className="mt-4 h-4 w-20" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-6 h-64 w-full" />
        </Card>
        <Card>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto mt-6 h-44 w-44 rounded-full" />
        </Card>
      </div>
    </div>
  )
}
