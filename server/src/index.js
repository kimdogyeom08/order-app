import 'dotenv/config'
import app from './app.js'
import { initializeDatabase } from './db/initialize.js'
import { pool } from './db/pool.js'

const port = Number(process.env.PORT ?? 3000)

try {
  await initializeDatabase()
} catch (error) {
  console.error('Database initialization failed:', error.code ?? 'unknown error')
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
