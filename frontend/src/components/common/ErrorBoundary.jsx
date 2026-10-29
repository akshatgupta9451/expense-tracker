import { Component } from 'react'
import Button from '@/components/ui/Button'

/** Catches render errors so one broken widget doesn't blank the whole app. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
        <p className="text-sm text-gray-500">Try reloading the page.</p>
        <Button onClick={() => window.location.reload()}>Reload</Button>
      </div>
    )
  }
}
