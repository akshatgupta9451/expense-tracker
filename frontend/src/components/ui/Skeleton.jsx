import { cn } from '@/utils/cn'

export default function Skeleton({ className }) {
  return (
    <div className={cn('animate-pulse rounded-lg bg-gray-200/70', className)} aria-hidden="true" />
  )
}
