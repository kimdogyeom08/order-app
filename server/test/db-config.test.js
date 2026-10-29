import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPoolConfig } from '../src/db/pool.js'

const pgConfig = {
  PGHOST: 'external-postgres.example.com',
  PGPORT: '5432',
  PGDATABASE: 'coffee',
  PGUSER: 'coffee-user',
  PGPASSWORD: 'local-password',
}

test('Render uses DATABASE_URL and TLS when PG variables are also present', () => {
  const config = getPoolConfig({
    ...pgConfig,
    DATABASE_URL: 'postgres://render-host/coffee',
    RENDER: 'true',
  })

  assert.equal(config.connectionString, 'postgres://render-host/coffee')
  assert.deepEqual(config.ssl, { rejectUnauthorized: false })
  assert.equal(Object.hasOwn(config, 'host'), false)
})

test('local complete PG variables retain precedence over DATABASE_URL', () => {
  const config = getPoolConfig({
    ...pgConfig,
    PGHOST: 'localhost',
    DATABASE_URL: 'postgres://localhost/coffee',
  })

  assert.equal(config.host, 'localhost')
  assert.equal(config.port, 5432)
  assert.equal(config.database, pgConfig.PGDATABASE)
  assert.equal(Object.hasOwn(config, 'connectionString'), false)
  assert.equal(Object.hasOwn(config, 'ssl'), false)
})

test('external Render Postgres connections use TLS with certificate verification', () => {
  const config = getPoolConfig({
    ...pgConfig,
    PGHOST: 'dpg-example-a.oregon-postgres.render.com',
  })

  assert.equal(config.host, 'dpg-example-a.oregon-postgres.render.com')
  assert.deepEqual(config.ssl, { rejectUnauthorized: true })
})
