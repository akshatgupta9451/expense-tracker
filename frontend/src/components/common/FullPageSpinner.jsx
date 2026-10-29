import Spinner from '@/components/ui/Spinner'

export default function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center text-brand-600">
      <Spinner className="h-8 w-8" />
    </div>
  )
}
