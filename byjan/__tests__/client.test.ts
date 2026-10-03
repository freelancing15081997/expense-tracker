describe('api client', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.resetModules();
  });

  test('returns the mock while EXPO_PUBLIC_API_URL is empty', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_USE_MOCKS;
    jest.resetModules();
    const { api } = require('../src/api/client');
    const value = await api('GET', '/v1/health', { mock: { ok: true }, delay: 1 });
    expect(value).toEqual({ ok: true });
  });

  test('simulate failures raises the mock error', async () => {
    const { api, setSimulateFailure, ApiError } = require('../src/api/client');
    setSimulateFailure(true);
    await expect(api('GET', '/v1/health', { mock: { ok: true }, delay: 1 })).rejects.toBeInstanceOf(ApiError);
    setSimulateFailure(false);
  });

  test('refreshes the access token once after a 401', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    delete process.env.EXPO_PUBLIC_USE_MOCKS;
    jest.resetModules();
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', text: async () => '{"code":"UNAUTHENTICATED","message":"Sign in required"}' })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ token: 'new-access', refreshToken: 'r2' }) })
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: async () => '{"ok":true}' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const { api, setAuthToken, setRefreshToken } = require('../src/api/client');
    setAuthToken('old');
    setRefreshToken('r1');
    const value = await api('GET', '/v1/health', { mock: { ok: false } });
    expect(value).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCall = fetchMock.mock.calls[1];
    expect(String(refreshCall[0])).toContain('/v1/auth/refresh');
    delete process.env.EXPO_PUBLIC_API_URL;
  });

  test('queues an entry when the network drops', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    delete process.env.EXPO_PUBLIC_USE_MOCKS;
    jest.resetModules();
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    const { api, offlineQueueSize } = require('../src/api/client');
    const saved = await api('POST', '/v1/entries', { mock: { id: 'm' }, body: { bookId: 'goa', amount: 80, title: 'Chai' } });
    expect(saved.title).toBe('Chai');
    expect(offlineQueueSize()).toBe(1);
    delete process.env.EXPO_PUBLIC_API_URL;
  });
});
