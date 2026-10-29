import { createHash, randomUUID } from 'node:crypto'
import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()
const maximumInteger = 2_147_483_647

class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

function requireId(value, label = 'ID') {
  const stringValue = String(value ?? '')
  if (!/^[1-9]\d*$/.test(stringValue) || !Number.isSafeInteger(Number(stringValue))) {
    throw new ApiError(400, 'INVALID_ID', `${label} 형식이 올바르지 않습니다.`)
  }
  return stringValue
}

function normalizeOrderItems(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw new ApiError(400, 'INVALID_ORDER', '주문 항목을 하나 이상 입력해 주세요.')
  }

  if (body.items.length > 100) {
    throw new ApiError(400, 'INVALID_ORDER', '한 주문에는 최대 100개 항목까지 담을 수 있습니다.')
  }

  return body.items.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiError(400, 'INVALID_ORDER_ITEM', '주문 항목 형식이 올바르지 않습니다.')
    }

    const menuId = requireId(item.menuId, '메뉴 ID')
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > maximumInteger) {
      throw new ApiError(400, 'INVALID_QUANTITY', '주문 수량은 1 이상의 정수여야 합니다.')
    }

    const optionIds = item.optionIds ?? []
    if (!Array.isArray(optionIds)) {
      throw new ApiError(400, 'INVALID_OPTIONS', '옵션 목록 형식이 올바르지 않습니다.')
    }

    const normalizedOptionIds = optionIds.map((optionId) => requireId(optionId, '옵션 ID'))
    if (new Set(normalizedOptionIds).size !== normalizedOptionIds.length) {
      throw new ApiError(400, 'INVALID_OPTIONS', '같은 옵션을 중복 선택할 수 없습니다.')
    }

    return {
      menuId,
      quantity: item.quantity,
      optionIds: normalizedOptionIds.sort(),
    }
  })
}

function mapOrderRows(rows) {
  const orders = new Map()

  for (const row of rows) {
    let order = orders.get(String(row.id))
    if (!order) {
      order = {
        orderId: Number(row.id),
        orderedAt: row.ordered_at.toISOString(),
        status: row.status,
        totalAmount: row.total_amount,
        items: [],
        itemMap: new Map(),
      }
      orders.set(String(row.id), order)
    }

    if (row.item_id === null) continue

    let item = order.itemMap.get(String(row.item_id))
    if (!item) {
      item = {
        menuId: Number(row.menu_id),
        menuName: row.menu_name_snapshot,
        quantity: row.quantity,
        unitPrice: row.unit_price,
        lineTotal: row.line_total,
        options: [],
      }
      order.itemMap.set(String(row.item_id), item)
      order.items.push(item)
    }

    if (row.option_id !== null) {
      item.options.push({
        optionId: Number(row.option_id),
        name: row.option_name_snapshot,
        price: row.option_price_snapshot,
      })
    }
  }

  return [...orders.values()].map(({ itemMap, ...order }) => order)
}

async function readOrders(query, values = []) {
  const result = await query(`
    SELECT
      orders.id,
      orders.ordered_at,
      orders.status,
      orders.total_amount,
      order_items.id AS item_id,
      order_items.menu_id,
      order_items.menu_name_snapshot,
      order_items.quantity,
      order_items.unit_price,
      order_items.line_total,
      order_item_options.option_id,
      order_item_options.option_name_snapshot,
      order_item_options.option_price_snapshot
    FROM orders
    LEFT JOIN order_items ON order_items.order_id = orders.id
    LEFT JOIN order_item_options ON order_item_options.order_item_id = order_items.id
    ${values.length ? 'WHERE orders.id = $1' : ''}
    ORDER BY orders.ordered_at DESC, orders.id DESC, order_items.id, order_item_options.id
  `, values)

  return mapOrderRows(result.rows)
}

router.get('/menus', async (_request, response) => {
  const result = await pool.query(`
    SELECT
      menus.id,
      menus.name,
      menus.description,
      menus.price,
      menus.image_url,
      options.id AS option_id,
      options.name AS option_name,
      options.price AS option_price
    FROM menus
    LEFT JOIN options ON options.menu_id = menus.id AND options.is_available = TRUE
    WHERE menus.is_available = TRUE
    ORDER BY menus.id, options.id
  `)
  const menus = new Map()

  for (const row of result.rows) {
    let menu = menus.get(String(row.id))
    if (!menu) {
      menu = {
        id: Number(row.id),
        name: row.name,
        description: row.description,
        price: row.price,
        imageUrl: row.image_url,
        options: [],
      }
      menus.set(String(row.id), menu)
    }

    if (row.option_id !== null) {
      menu.options.push({
        id: Number(row.option_id),
        name: row.option_name,
        price: row.option_price,
      })
    }
  }

  response.json({ items: [...menus.values()] })
})

router.get('/admin/menus', async (_request, response) => {
  const result = await pool.query(`
    SELECT id, name, description, price, image_url, stock_quantity, is_available
    FROM menus
    ORDER BY id
  `)

  response.json({
    items: result.rows.map((menu) => ({
      id: Number(menu.id),
      name: menu.name,
      description: menu.description,
      price: menu.price,
      imageUrl: menu.image_url,
      stockQuantity: menu.stock_quantity,
      isAvailable: menu.is_available,
    })),
  })
})

router.patch('/admin/menus/:menuId/stock', async (request, response) => {
  const menuId = requireId(request.params.menuId, '메뉴 ID')
  const adjustment = request.body?.adjustment
  if (adjustment !== 1 && adjustment !== -1) {
    throw new ApiError(400, 'INVALID_ADJUSTMENT', '재고 조정값은 1 또는 -1이어야 합니다.')
  }

  const updated = await pool.query(`
    UPDATE menus
    SET stock_quantity = stock_quantity + $2, updated_at = NOW()
    WHERE id = $1 AND stock_quantity + $2 >= 0
    RETURNING id, name, stock_quantity, is_available
  `, [menuId, adjustment])

  if (updated.rowCount === 0) {
    const exists = await pool.query('SELECT 1 FROM menus WHERE id = $1', [menuId])
    if (exists.rowCount === 0) {
      throw new ApiError(404, 'MENU_NOT_FOUND', '메뉴를 찾을 수 없습니다.')
    }
    throw new ApiError(409, 'INSUFFICIENT_STOCK', '재고는 0개 미만이 될 수 없습니다.')
  }

  const menu = updated.rows[0]
  response.json({
    id: Number(menu.id),
    name: menu.name,
    stockQuantity: menu.stock_quantity,
    isAvailable: menu.is_available,
  })
})

router.post('/orders', async (request, response) => {
  const items = normalizeOrderItems(request.body)
  const idempotencyKey = request.get('Idempotency-Key')?.trim() || randomUUID()
  if (idempotencyKey.length > 200) {
    throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key는 200자 이하여야 합니다.')
  }

  const requestHash = createHash('sha256').update(JSON.stringify(items)).digest('hex')
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    const insertedKey = await client.query(`
      INSERT INTO idempotency_keys (idempotency_key, request_hash)
      VALUES ($1, $2)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING idempotency_key
    `, [idempotencyKey, requestHash])

    if (insertedKey.rowCount === 0) {
      const existingKey = await client.query(`
        SELECT request_hash, response
        FROM idempotency_keys
        WHERE idempotency_key = $1
        FOR UPDATE
      `, [idempotencyKey])

      if (existingKey.rows[0].request_hash !== requestHash) {
        throw new ApiError(409, 'IDEMPOTENCY_KEY_REUSED', '같은 Idempotency-Key로 다른 주문을 제출할 수 없습니다.')
      }

      if (existingKey.rows[0].response) {
        await client.query('COMMIT')
        response.set('Idempotency-Replayed', 'true')
        response.status(200).json(existingKey.rows[0].response)
        return
      }
    }

    const menuIds = [...new Set(items.map((item) => item.menuId))].sort((left, right) => Number(left) - Number(right))
    const menuResult = await client.query(`
      SELECT id, name, price, stock_quantity, is_available
      FROM menus
      WHERE id = ANY($1::bigint[])
      ORDER BY id
      FOR UPDATE
    `, [menuIds])
    const menuMap = new Map(menuResult.rows.map((menu) => [String(menu.id), menu]))

    for (const menuId of menuIds) {
      const menu = menuMap.get(menuId)
      if (!menu) throw new ApiError(400, 'MENU_NOT_FOUND', '주문에 포함된 메뉴를 찾을 수 없습니다.')
      if (!menu.is_available) throw new ApiError(400, 'MENU_UNAVAILABLE', '현재 주문할 수 없는 메뉴가 포함되어 있습니다.')
    }

    const optionIds = [...new Set(items.flatMap((item) => item.optionIds))]
    const optionResult = optionIds.length === 0
      ? { rows: [] }
      : await client.query(`
          SELECT id, menu_id, name, price, is_available
          FROM options
          WHERE id = ANY($1::bigint[])
        `, [optionIds])
    const optionMap = new Map(optionResult.rows.map((option) => [String(option.id), option]))
    const stockByMenu = new Map()
    let totalAmount = 0
    const pricedItems = items.map((item) => {
      const menu = menuMap.get(item.menuId)
      const selectedOptions = item.optionIds.map((optionId) => {
        const option = optionMap.get(optionId)
        if (!option || String(option.menu_id) !== item.menuId) {
          throw new ApiError(400, 'INVALID_OPTION', '메뉴에 연결되지 않았거나 존재하지 않는 옵션입니다.')
        }
        if (!option.is_available) throw new ApiError(400, 'OPTION_UNAVAILABLE', '현재 선택할 수 없는 옵션이 포함되어 있습니다.')
        return option
      })

      const unitPrice = menu.price
      const optionPrice = selectedOptions.reduce((sum, option) => sum + option.price, 0)
      const lineTotal = (unitPrice + optionPrice) * item.quantity
      if (unitPrice > maximumInteger || lineTotal > maximumInteger) {
        throw new ApiError(400, 'ORDER_AMOUNT_TOO_LARGE', '주문 금액이 허용 범위를 초과했습니다.')
      }

      totalAmount += lineTotal
      stockByMenu.set(item.menuId, (stockByMenu.get(item.menuId) ?? 0) + item.quantity)
      return { ...item, menu, selectedOptions, unitPrice, lineTotal }
    })

    if (totalAmount > maximumInteger) {
      throw new ApiError(400, 'ORDER_AMOUNT_TOO_LARGE', '주문 금액이 허용 범위를 초과했습니다.')
    }

    for (const [menuId, quantity] of stockByMenu) {
      const menu = menuMap.get(menuId)
      if (menu.stock_quantity < quantity) {
        throw new ApiError(409, 'INSUFFICIENT_STOCK', `${menu.name} 재고가 부족합니다.`)
      }
      await client.query(`
        UPDATE menus
        SET stock_quantity = stock_quantity - $2, updated_at = NOW()
        WHERE id = $1
      `, [menuId, quantity])
    }

    const createdOrder = await client.query(`
      INSERT INTO orders (status, total_amount)
      VALUES ('received', $1)
      RETURNING id
    `, [totalAmount])
    const orderId = createdOrder.rows[0].id

    for (const item of pricedItems) {
      const createdItem = await client.query(`
        INSERT INTO order_items (
          order_id, menu_id, menu_name_snapshot, quantity, unit_price, line_total
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [orderId, item.menuId, item.menu.name, item.quantity, item.unitPrice, item.lineTotal])

      for (const option of item.selectedOptions) {
        await client.query(`
          INSERT INTO order_item_options (
            order_item_id, option_id, option_name_snapshot, option_price_snapshot
          )
          VALUES ($1, $2, $3, $4)
        `, [createdItem.rows[0].id, option.id, option.name, option.price])
      }
    }

    const [order] = await readOrders((text, values) => client.query(text, values), [orderId])
    await client.query(
      'UPDATE idempotency_keys SET response = $2::jsonb WHERE idempotency_key = $1',
      [idempotencyKey, JSON.stringify(order)],
    )
    await client.query('COMMIT')
    response.status(201).json(order)
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    if (error instanceof ApiError) throw error
    console.error('Order creation failed:', error.code ?? 'unknown error')
    throw new ApiError(500, 'ORDER_CREATION_FAILED', '주문을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    client.release()
  }
})

router.get('/admin/orders', async (_request, response) => {
  const items = await readOrders((text, values) => pool.query(text, values))
  response.json({ items })
})

router.get('/orders/:orderId', async (request, response) => {
  const orderId = requireId(request.params.orderId, '주문 ID')
  const [order] = await readOrders((text, values) => pool.query(text, values), [orderId])
  if (!order) throw new ApiError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.')
  response.json(order)
})

router.patch('/admin/orders/:orderId/status', async (request, response) => {
  const orderId = requireId(request.params.orderId, '주문 ID')
  const nextStatus = request.body?.status
  const expectedStatus = nextStatus === 'preparing'
    ? 'received'
    : nextStatus === 'completed'
      ? 'preparing'
      : null

  if (!expectedStatus) {
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', '주문 상태는 접수, 제조 중, 제조 완료 순서로만 변경할 수 있습니다.')
  }

  const updated = await pool.query(`
    UPDATE orders
    SET status = $2, updated_at = NOW()
    WHERE id = $1 AND status = $3
    RETURNING id
  `, [orderId, nextStatus, expectedStatus])

  if (updated.rowCount === 0) {
    const exists = await pool.query('SELECT status FROM orders WHERE id = $1', [orderId])
    if (exists.rowCount === 0) throw new ApiError(404, 'ORDER_NOT_FOUND', '주문을 찾을 수 없습니다.')
    throw new ApiError(409, 'INVALID_STATUS_TRANSITION', '현재 주문 상태에서 요청한 상태로 변경할 수 없습니다.')
  }

  const [order] = await readOrders((text, values) => pool.query(text, values), [orderId])
  response.json(order)
})

export default router