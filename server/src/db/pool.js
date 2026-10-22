import pg from 'pg'

const { Pool } = pg

const hasPostgresConfig = [
  'PGHOST',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
].every((key) => process.env[key])

export const pool = new Pool(hasPostgresConfig
  ? {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT),
      database: process.env.PGDATABASE,
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
    }
  : {
      connectionString: process.env.DATABASE_URL,
    })

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error:', error.message)
})

export async function checkDatabaseConnection() {
  await pool.query('SELECT 1')
}
