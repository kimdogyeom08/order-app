export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(data?.error?.message ?? '요청을 처리하지 못했습니다.')
    error.status = response.status
    error.code = data?.error?.code
    throw error
  }

  return data
}