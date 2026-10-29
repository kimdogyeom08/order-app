import 'dotenv/config'
import app from './app.js'
import { initializeDatabase } from './db/initialize.js'
import { pool } from './db/pool.js'

const port = Number(process.env.PORT ?? 3000)

try {
  await initializeDatabase()
} catch (error) {
  const code = error.code ?? 'unknown error'
  const advice = code === '28000'
    ? ' Check the Render Internal Database URL and TLS connection settings.'
    : code === '28P01'
      ? ' Check the database username and password in DATABASE_URL.'
      : ''
  console.error(`Database initialization failed: ${code}.${advice}`)
  process.exit(1)
}

const server = app.listen(port, () => {
  console.log(`COZY API server listening on port ${port}`)
})

function shutdown(signal) {
  console.log(`${signal} received. Shutting down gracefully.`)
  server.close(async (error) => {
    if (error) {
      console.error('HTTP server shutdown failed:', error)
      process.exitCode = 1
    }

    await pool.end()
    process.exit()
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
