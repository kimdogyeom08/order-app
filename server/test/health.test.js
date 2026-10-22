import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import app from '../src/app.js'

let server
let baseUrl

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
})

test('GET /api/health reports that the API is running', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { origin: 'http://127.0.0.1:5173' },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173')
  assert.deepEqual(await response.json(), { status: 'ok' })
})

test('unknown routes return the standard not-found response', async () => {
  const response = await fetch(`${baseUrl}/api/unknown`)

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    error: {
      code: 'NOT_FOUND',
      message: '요청한 경로를 찾을 수 없습니다.',
    },
  })
})

test('invalid JSON returns a client error', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{invalid',
  })

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: {
      code: 'INVALID_JSON',
      message: '요청 본문이 올바른 JSON 형식이 아닙니다.',
    },
  })
})
