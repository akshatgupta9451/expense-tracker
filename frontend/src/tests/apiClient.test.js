import api, { refreshClient, setSessionExpiredHandler } from '@/services/apiClient'
import { tokenStore } from '@/services/tokenStore'

/** Fake axios adapter: `handler(config)` returns [status, data]. */
function mockAdapter(instance, handler) {
  const calls = []
  instance.defaults.adapter = async (config) => {
    calls.push(config)
    const [status, data] = await handler(config, calls.length)
    const response = { status, data, headers: {}, config, statusText: String(status) }
    if (status >= 400) {
      const err = new Error(`HTTP ${status}`)
      err.config = config
      err.response = response
      throw err
    }
    return response
  }
  return calls
}

beforeEach(() => tokenStore.clear())

test('attaches the access token', async () => {
  tokenStore.set('abc')
  const calls = mockAdapter(api, () => [200, {}])
  await api.get('/users/me')
  expect(calls[0].headers.Authorization).toBe('Bearer abc')
})

test('on 401 it refreshes once and retries the request', async () => {
  tokenStore.set('expired')
  const refreshCalls = mockAdapter(refreshClient, () => [200, { access_token: 'fresh' }])
  const calls = mockAdapter(api, (config) =>
    config.headers.Authorization === 'Bearer fresh' ? [200, { ok: true }] : [401, {}],
  )

  const { data } = await api.get('/users/me')

  expect(data).toEqual({ ok: true })
  expect(refreshCalls).toHaveLength(1)
  expect(calls).toHaveLength(2)
  expect(tokenStore.get()).toBe('fresh')
})

test('concurrent 401s share a single refresh request', async () => {
  tokenStore.set('expired')
  const refreshCalls = mockAdapter(refreshClient, async () => {
    await new Promise((r) => setTimeout(r, 10))
    return [200, { access_token: 'fresh' }]
  })
  mockAdapter(api, (config) =>
    config.headers.Authorization === 'Bearer fresh' ? [200, {}] : [401, {}],
  )

  await Promise.all([api.get('/a'), api.get('/b'), api.get('/c')])
  // The backend rotates refresh tokens; parallel refreshes would trip reuse detection.
  expect(refreshCalls).toHaveLength(1)
})

test('failed refresh clears the token and ends the session', async () => {
  tokenStore.set('expired')
  const expired = vi.fn()
  setSessionExpiredHandler(expired)
  mockAdapter(refreshClient, () => [401, {}])
  mockAdapter(api, () => [401, {}])

  await expect(api.get('/users/me')).rejects.toBeTruthy()
  expect(tokenStore.get()).toBeNull()
  expect(expired).toHaveBeenCalledOnce()
})

test('login failures are not retried via refresh', async () => {
  const refreshCalls = mockAdapter(refreshClient, () => [200, { access_token: 'x' }])
  mockAdapter(api, () => [401, { error: { message: 'Invalid email or password' } }])

  await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } })
  expect(refreshCalls).toHaveLength(0)
})
