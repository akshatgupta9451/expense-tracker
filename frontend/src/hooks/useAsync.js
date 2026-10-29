import { useCallback, useEffect, useRef, useState } from 'react'
import { getErrorMessage } from '@/utils/errors'

/**
 * Run an async loader and track { data, error, loading }. Re-runs when `deps` change.
 * Responses from outdated calls are ignored, so fast filter changes can't show stale data.
 *
 *   const { data, loading, error, reload } = useAsync(() => api.get(...), [filters])
 */
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const callId = useRef(0)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps)

  const reload = useCallback(async () => {
    const id = ++callId.current
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await run()
      if (id === callId.current) setState({ data, error: null, loading: false })
    } catch (err) {
      if (id === callId.current)
        setState((s) => ({ ...s, error: getErrorMessage(err), loading: false }))
    }
  }, [run])

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}
