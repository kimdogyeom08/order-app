import cors from 'cors'
import express from 'express'
import { checkDatabaseConnection } from './db/pool.js'
import apiRouter from './routes/api.js'

const app = express()
const allowedOrigins = (
  process.env.FRONTEND_ORIGINS
    ?? 'http://localhost:5173,http://127.0.0.1:5173'
).split(',').map((origin) => origin.trim())

app.use(cors({
  origin: allowedOrigins,
}))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/health/db', async (_request, response) => {
  try {
    await checkDatabaseConnection()
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    console.error('Database health check failed:', error.message)
    response.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: '데이터베이스에 연결할 수 없습니다.',
      },
    })
  }
})

app.use('/api', apiRouter)

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: '요청한 경로를 찾을 수 없습니다.',
    },
  })
})

app.use((error, _request, response, _next) => {
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: '요청 본문이 올바른 JSON 형식이 아닙니다.',
      },
    })
  }

  if (Number.isInteger(error.status) && error.code && error.message) {
    return response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    })
  }

  console.error('Unhandled request error:', error)
  return response.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 내부 오류가 발생했습니다.',
    },
  })
})

export default app
