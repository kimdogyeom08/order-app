import { useEffect, useState } from 'react'
import { apiRequest } from './api.js'
import './AdminDashboard.css'

const formatPrice = (price) => `${new Intl.NumberFormat('ko-KR').format(price)}원`

const formatOrderDate = (date) =>
  new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date))

const statusLabels = {
  received: '주문 접수',
  preparing: '제조 중',
  completed: '제조 완료',
}

function mapOrder(order) {
  return {
    id: String(order.orderId),
    createdAt: order.orderedAt,
    status: order.status,
    total: order.totalAmount,
    items: order.items.map((item) => ({
      name: item.menuName,
      quantity: item.quantity,
      options: item.options.map((option) => option.name).join(' · '),
    })),
  }
}

function DashboardIcon({ type }) {
  if (type === 'orders') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" />
      </svg>
    )
  }

  if (type === 'received') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16l1 13H3zM8 7a4 4 0 0 1 8 0M9 13l2 2 4-4" />
      </svg>
    )
  }

  if (type === 'preparing') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h13v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM18 11h1a2 2 0 0 1 0 4h-1M8 5c-1-1 1-2 0-3M12 5c-1-1 1-2 0-3M16 5c-1-1 1-2 0-3" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  )
}

function AdminDashboard() {
  const [inventory, setInventory] = useState([])
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reload, setReload] = useState(0)
  const [busyActions, setBusyActions] = useState({})
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      apiRequest('/admin/menus'),
      apiRequest('/admin/orders'),
    ])
      .then(([menuData, orderData]) => {
        if (cancelled) return
        setInventory(menuData.items.map((menu) => ({ ...menu, quantity: menu.stockQuantity })))
        setOrders(orderData.items.map(mapOrder))
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  const reloadAdminData = () => {
    setLoading(true)
    setLoadError('')
    setReload((current) => current + 1)
  }

  const adjustStock = async (menuId, adjustment) => {
    const actionKey = `stock-${menuId}`
    setBusyActions((current) => ({ ...current, [actionKey]: true }))
    setNotice(null)

    try {
      const menu = await apiRequest(`/admin/menus/${menuId}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ adjustment }),
      })
      setInventory((current) => current.map((item) => (
        item.id === menu.id ? { ...item, quantity: menu.stockQuantity } : item
      )))
      setNotice({ type: 'success', text: `${menu.name} 재고를 변경했습니다.` })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusyActions((current) => ({ ...current, [actionKey]: false }))
    }
  }

  const advanceOrder = async (order) => {
    const actionKey = `order-${order.id}`
    setBusyActions((current) => ({ ...current, [actionKey]: true }))
    setNotice(null)

    try {
      const updated = await apiRequest(`/admin/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'preparing' }),
      })
      setOrders((current) => current.map((item) => (
        item.id === String(updated.orderId) ? mapOrder(updated) : item
      )))
      setNotice({ type: 'success', text: `주문 ${order.id}을(를) 접수했습니다.` })
    } catch (error) {
      if (error.status === 409) reloadAdminData()
      setNotice({ type: 'error', text: error.message })
    } finally {
      setBusyActions((current) => ({ ...current, [actionKey]: false }))
    }
  }

  const summary = [
    { label: '총 주문', value: orders.length, icon: 'orders', tone: 'blue' },
    { label: '주문 접수', value: orders.filter((order) => order.status === 'received').length, icon: 'received', tone: 'amber' },
    { label: '제조 중', value: orders.filter((order) => order.status === 'preparing').length, icon: 'preparing', tone: 'violet' },
    { label: '제조 완료', value: orders.filter((order) => order.status === 'completed').length, icon: 'completed', tone: 'green' },
  ]

  return (
    <main className="admin-page" id="admin">
      <section className="admin-welcome" aria-labelledby="admin-title">
        <div>
          <p className="admin-eyebrow"><span /> COZY COFFEE · ADMIN</p>
          <h1 id="admin-title">매장 운영 한눈에 보기</h1>
          <p className="admin-welcome-copy">오늘의 매장 현황을 한눈에 확인하고 관리해 보세요.</p>
        </div>
        <div className="admin-welcome-art" aria-hidden="true">
          <span className="admin-welcome-sun" />
          <span className="admin-welcome-cup"><i /></span>
          <span className="admin-welcome-steam admin-welcome-steam--one" />
          <span className="admin-welcome-steam admin-welcome-steam--two" />
          <span className="admin-welcome-bean admin-welcome-bean--one" />
          <span className="admin-welcome-bean admin-welcome-bean--two" />
        </div>
      </section>

      <section className="admin-section dashboard-section" aria-labelledby="summary-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">OVERVIEW</p>
            <h2 id="summary-title">관리자 대시보드</h2>
          </div>
          <span className="admin-live"><span /> 실시간 현황</span>
        </div>
        {notice && (
          <p className={`order-notice order-notice--${notice.type}`} role="status" aria-live="polite">
            <span aria-hidden="true">{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}
          </p>
        )}
        {loadError && (
          <div className="admin-empty-state" role="alert">
            <h3>관리 데이터를 불러오지 못했습니다.</h3>
            <p>{loadError}</p>
            <button type="button" onClick={reloadAdminData}>다시 시도</button>
          </div>
        )}
        {loading && <p className="section-description" role="status">관리 데이터를 불러오는 중입니다.</p>}
        <div className="summary-grid">
          {summary.map((item) => (
            <article className="summary-card" key={item.label}>
              <div className={`summary-icon summary-icon--${item.tone}`}>
                <DashboardIcon type={item.icon} />
              </div>
              <div className="summary-card-copy">
                <p>{item.label}</p>
                <div className="summary-value">{item.value}<span>건</span></div>
              </div>
              <span className={`summary-dot summary-dot--${item.tone}`} />
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section inventory-section" aria-labelledby="inventory-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">STOCK MANAGEMENT</p>
            <h2 id="inventory-title">재고 현황</h2>
          </div>
          <span className="section-description">총 {inventory.length}개 메뉴</span>
        </div>
        <div className="inventory-grid">
          {inventory.map((item) => {
            const status = item.quantity === 0 ? 'sold-out' : item.quantity < 5 ? 'warning' : 'normal'
            const statusLabel = item.quantity === 0 ? '품절' : item.quantity < 5 ? '주의' : '정상'

            return (
            <article className="inventory-card" key={item.id}>
              <div className="inventory-card-body">
                  <div className="inventory-stock-row">
                    <h3>{item.name}</h3>
                    <p className="inventory-count"><strong>{item.quantity}</strong><span>개</span></p>
                    <span className={`stock-status stock-status--${status}`}>
                      <span />{statusLabel}
                    </span>
                  </div>
                  <div className="inventory-actions" aria-label={`${item.name} 재고 조정`}>
                    <button
                      className="stock-button stock-button--decrease"
                      type="button"
                      aria-label={`${item.name} 재고 1개 감소`}
                      disabled={item.quantity === 0 || busyActions[`stock-${item.id}`] || loading}
                      onClick={() => adjustStock(item.id, -1)}
                    >
                      −
                    </button>
                    <button
                      className="stock-button stock-button--increase"
                      type="button"
                      aria-label={`${item.name} 재고 1개 증가`}
                      disabled={busyActions[`stock-${item.id}`] || loading}
                      onClick={() => adjustStock(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="admin-section orders-section" aria-labelledby="orders-title">
        <div className="admin-section-heading">
          <div>
            <p className="admin-section-kicker">ORDER MANAGEMENT</p>
            <h2 id="orders-title">주문 현황</h2>
          </div>
          <span className="section-description">{orders.length}건의 주문</span>
        </div>

        {!loading && orders.length > 0 ? (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-main">
                  <div className="order-time">
                    <span className="order-time-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></svg>
                    </span>
                    <div>
                      <span className="order-date">{formatOrderDate(order.createdAt)}</span>
                      <span className="order-number">주문 {order.id}</span>
                    </div>
                  </div>
                  <ul className="order-items">
                    {order.items.map((item, index) => (
                      <li key={`${order.id}-${item.name}-${index}`}>
                        <span className="order-item-name">{item.name}</span>
                        {item.options && <span className="order-item-options">{item.options}</span>}
                        <span className="order-item-quantity">× {item.quantity}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="order-total">
                    <span>주문 금액</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                  <div className="order-status-wrap">
                    <span className={`order-status order-status--${order.status}`}>
                      <span />{statusLabels[order.status]}
                    </span>
                  </div>
                </div>
                <div className="order-card-action">
                  {order.status === 'received' ? (
                    <button
                      className="start-order-button"
                      type="button"
                      disabled={busyActions[`order-${order.id}`] || loading}
                      onClick={() => advanceOrder(order)}
                    >
                      <span aria-hidden="true">▶</span> 주문 접수
                    </button>
                  ) : (
                    <span className="order-action-note">
                      {order.status === 'preparing' ? '음료를 준비하고 있어요' : '픽업 준비가 완료됐어요'}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : !loading && !loadError ? (
          <div className="admin-empty-state">
            <span className="admin-empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4" /></svg>
            </span>
            <h3>아직 접수된 주문이 없어요</h3>
            <p>새로운 주문이 들어오면 이곳에 표시됩니다.</p>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default AdminDashboard
