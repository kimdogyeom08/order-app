import pg from 'pg'

const { Pool } = pg

const postgresConfigKeys = [
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
]

export function getPoolConfig(env = process.env) {
  const hasPostgresConfig = postgresConfigKeys.every((key) => env[key])
  const isRender = env.RENDER === 'true'
  const useDatabaseUrl = Boolean(env.DATABASE_URL)
    && (isRender || !hasPostgresConfig)
  const config = useDatabaseUrl
    ? { connectionString: env.DATABASE_URL }
    : {
        host: env.PGHOST,
        port: Number(env.PGPORT),
        database: env.PGDATABASE,
        user: env.PGUSER,
        password: env.PGPASSWORD,
      }

  const databaseHost = useDatabaseUrl
    ? new URL(env.DATABASE_URL).hostname
    : env.PGHOST
  const isExternalRenderDatabase = databaseHost?.toLowerCase().endsWith('.render.com')

  if (isRender || isExternalRenderDatabase) {
    config.ssl = { rejectUnauthorized: Boolean(isExternalRenderDatabase) }
  }

  return config
}

export const pool = new Pool(getPoolConfig())

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error:', error.message)
})

export async function checkDatabaseConnection() {
  await pool.query('SELECT 1')
}
