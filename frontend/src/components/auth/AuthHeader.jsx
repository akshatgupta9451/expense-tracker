export default function AuthHeader({ title, subtitle }) {
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
    </div>
  )
}
