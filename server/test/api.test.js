import 'dotenv/config'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { after, before, test } from 'node:test'

const hasDatabaseConfig = Boolean(process.env.DATABASE_URL)
  || ['PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD'].every((key) => process.env[key])

let app
let pool
let server
let baseUrl
let menuId
let optionId
let menuName
let idempotencyKey
const createdOrderIds = new Set()

before(async () => {
  if (!hasDatabaseConfig) return

  const [{ default: apiApp }, database, initializer] = await Promise.all([
    import('../src/app.js'),
    import('../src/db/pool.js'),
    import('../src/db/initialize.js'),
  ])
  app = apiApp
  pool = database.pool
  await initializer.initializeDatabase()

  menuName = `API integration ${randomUUID()}`
  const menu = await pool.query(`
    INSERT INTO menus (name, description, price, stock_quantity)
    VALUES ($1, 'API integration fixture', 1250, 5)
    RETURNING id
  `, [menuName])
  menuId = menu.rows[0].id
  const option = await pool.query(`
    INSERT INTO options (menu_id, name, price)
    VALUES ($1, 'Test option', 250)
    RETURNING id
  `, [menuId])
  optionId = option.rows[0].id
  idempotencyKey = `api-test-${randomUUID()}`

  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  if (pool && menuId) {
    const orderIds = [...createdOrderIds]
    if (orderIds.length) {
      await pool.query('DELETE FROM orders WHERE id = ANY($1::bigint[])', [orderIds])
    }
    if (idempotencyKey) {
      await pool.query('DELETE FROM idempotency_keys WHERE idempotency_key = $1', [idempotencyKey])
    }
    await pool.query('DELETE FROM options WHERE menu_id = $1', [menuId])
    await pool.query('DELETE FROM menus WHERE id = $1', [menuId])
  }
})

test('menu, order, inventory, idempotency, and status APIs follow the database rules', {
  skip: !hasDatabaseConfig,
}, async () => {
  const menusResponse = await fetch(`${baseUrl}/api/menus`)
  const menus = await menusResponse.json()
  const fixtureMenu = menus.items.find((item) => item.id === Number(menuId))
  assert.equal(menusResponse.status, 200)
  assert.equal(fixtureMenu.options[0].id, Number(optionId))
  assert.equal(Object.hasOwn(fixtureMenu, 'stockQuantity'), false)

  const inventoryResponse = await fetch(`${baseUrl}/api/admin/menus`)
  const inventory = await inventoryResponse.json()
  assert.equal(inventory.items.find((item) => item.id === Number(menuId)).stockQuantity, 5)

  const decreaseResponse = await fetch(`${baseUrl}/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjustment: -1 }),
  })
  assert.equal((await decreaseResponse.json()).stockQuantity, 4)

  const increaseResponse = await fetch(`${baseUrl}/api/admin/menus/${menuId}/stock`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ adjustment: 1 }),
  })
  assert.equal((await increaseResponse.json()).stockQuantity, 5)

  const request = {
    items: [{ menuId: Number(menuId), quantity: 2, optionIds: [Number(optionId)] }],
  }
  const orderResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  })
  const order = await orderResponse.json()
  createdOrderIds.add(String(order.orderId))
  assert.equal(orderResponse.status, 201)
  assert.equal(order.totalAmount, 3000)
  assert.equal(order.items[0].unitPrice, 1250)
  assert.equal(order.items[0].lineTotal, 3000)
  assert.equal(order.items[0].options[0].price, 250)

  const replayResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(request),
  })
  const replay = await replayResponse.json()
  assert.equal(replayResponse.status, 200)
  assert.equal(replay.orderId, order.orderId)

  const reusedKeyResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ items: [{ menuId: Number(menuId), quantity: 1, optionIds: [] }] }),
  })
  assert.equal(reusedKeyResponse.status, 409)

  const insufficientResponse = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ menuId: Number(menuId), quantity: 6, optionIds: [] }] }),
  })
  assert.equal(insufficientResponse.status, 409)
  const stockAfterFailure = await pool.query('SELECT stock_quantity FROM menus WHERE id = $1', [menuId])
  assert.equal(stockAfterFailure.rows[0].stock_quantity, 3)

  const detailResponse = await fetch(`${baseUrl}/api/orders/${order.orderId}`)
  const detail = await detailResponse.json()
  assert.equal(detailResponse.status, 200)
  assert.equal(detail.items[0].menuName, menuName)

  const preparingResponse = await fetch(`${baseUrl}/api/admin/orders/${order.orderId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'preparing' }),
  })
  assert.equal((await preparingResponse.json()).status, 'preparing')

  const completedResponse = await fetch(`${baseUrl}/api/admin/orders/${order.orderId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  })
  assert.equal((await completedResponse.json()).status, 'completed')

  const invalidTransitionResponse = await fetch(`${baseUrl}/api/admin/orders/${order.orderId}/status`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'preparing' }),
  })
  assert.equal(invalidTransitionResponse.status, 409)
})
