import { useEffect, useRef, useState } from 'react'
import AdminDashboard from './AdminDashboard.jsx'
import { apiRequest } from './api.js'
import './App.css'

const menuPresentation = {
  '아메리카노 (ICE)': { englishName: 'Iced Americano', art: 'iced', badge: 'BEST' },
  '아메리카노 (HOT)': { englishName: 'Hot Americano', art: 'hot' },
  카페라떼: { englishName: 'Cafe Latte', art: 'latte', badge: 'POPULAR' },
  '바닐라 라떼': { englishName: 'Vanilla Latte', art: 'vanilla' },
  콜드브루: { englishName: 'Cold Brew', art: 'cold', badge: 'SLOW BREW' },
  카푸치노: { englishName: 'Cappuccino', art: 'cappuccino' },
}

const formatPrice = (price) => `${new Intl.NumberFormat('ko-KR').format(price)}원`

function CoffeeArtwork({ art, id }) {
  return (
    <svg className={`coffee-art coffee-art--${art}`} viewBox="0 0 320 220" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-cup`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={art === 'iced' || art === 'cold' ? '#f3fbff' : '#fffdf8'} />
          <stop offset="1" stopColor={art === 'iced' || art === 'cold' ? '#b6dcf0' : '#e9ddd0'} />
        </linearGradient>
        <linearGradient id={`${id}-coffee`} x1="0" x2="0.9" y1="0" y2="1">
          <stop offset="0" stopColor={art === 'latte' || art === 'vanilla' || art === 'cappuccino' ? '#b77a4f' : '#583522'} />
          <stop offset="1" stopColor={art === 'latte' || art === 'vanilla' || art === 'cappuccino' ? '#70452e' : '#271a15'} />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#433126" floodOpacity=".18" />
        </filter>
      </defs>
      <ellipse cx="160" cy="190" rx="72" ry="10" fill="#6f5848" opacity=".12" />
      {art === 'iced' || art === 'cold' ? (
        <g filter={`url(#${id}-shadow)`}>
          <path d="M119 69h82l-9 105c-1 9-7 14-16 14h-32c-9 0-15-5-16-14z" fill={`url(#${id}-cup)`} stroke="#d8e8ed" strokeWidth="3" />
          <path d="M124 99h72l-6 72c-.7 7-5 11-12 11h-31c-7 0-11-4-12-11z" fill={`url(#${id}-coffee)`} />
          <path d="M145 81l-8 27 19 13 15-16-4-24z" fill="#eaf8ff" opacity=".9" stroke="#fff" strokeWidth="2" />
          <path d="M170 105l-5 20 19 12 9-23z" fill="#d9f0fc" opacity=".92" stroke="#fff" strokeWidth="2" />
          <path d="M163 67l17-37" fill="none" stroke="#f6fcff" strokeWidth="8" strokeLinecap="round" />
          <path d="M115 68h90l-5 11h-80z" fill="#f8fcfc" stroke="#d7e7eb" strokeWidth="3" />
          <path d="M137 126c13 9 33 9 47 0" fill="none" stroke="#fff" strokeOpacity=".42" strokeWidth="4" strokeLinecap="round" />
        </g>
      ) : (
        <g filter={`url(#${id}-shadow)`}>
          <path d="M110 86h100l-9 82c-1 9-8 15-17 15h-48c-9 0-16-6-17-15z" fill={`url(#${id}-cup)`} />
          <ellipse cx="160" cy="86" rx="50" ry="13" fill="#fffaf3" />
          <ellipse cx="160" cy="87" rx="40" ry="8" fill={`url(#${id}-coffee)`} />
          {art === 'latte' || art === 'vanilla' || art === 'cappuccino' ? (
            <>
              <path d="M144 86c6-7 14-7 20 0 6 7 14 7 20 0" fill="none" stroke="#f5e3cb" strokeWidth="4" strokeLinecap="round" />
              <path d="M160 83c-5 8-4 13 0 17 4-4 5-9 0-17z" fill="#f5e3cb" />
            </>
          ) : null}
          <path d="M210 103h12c17 0 17 35 0 35h-16" fill="none" stroke="#efe5da" strokeWidth="9" />
          <path d="M130 108v49" stroke="#fff" strokeOpacity=".6" strokeWidth="5" strokeLinecap="round" />
          <path d="M145 66c-9-11 8-13 1-26M171 66c-8-10 9-13 2-24" fill="none" stroke="#c0a895" strokeWidth="3" strokeLinecap="round" opacity=".55" />
          <path d="M118 181h84" stroke="#eee2d5" strokeWidth="5" strokeLinecap="round" />
        </g>
      )}
      <circle cx="76" cy="75" r="4" fill="#fff" opacity=".65" />
      <circle cx="246" cy="137" r="3" fill="#fff" opacity=".7" />
    </svg>
  )
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 1.9-1.4L22 8H6" />
      <circle cx="10" cy="20" r="1.2" />
      <circle cx="18" cy="20" r="1.2" />
    </svg>
  )
}

function App() {
  const [activePage, setActivePage] = useState(() =>
    window.location.hash === '#admin' ? 'admin' : 'order',
  )
  const [menuItems, setMenuItems] = useState([])
  const [menuLoading, setMenuLoading] = useState(true)
  const [menuError, setMenuError] = useState('')
  const [menuReload, setMenuReload] = useState(0)
  const [selectedOptions, setSelectedOptions] = useState({})
  const [cart, setCart] = useState([])
  const [notice, setNotice] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const orderRequestKey = useRef(null)

  useEffect(() => {
    let cancelled = false

    apiRequest('/menus')
      .then((data) => {
        if (!cancelled) setMenuItems(data.items)
      })
      .catch((error) => {
        if (!cancelled) setMenuError(error.message)
      })
      .finally(() => {
        if (!cancelled) setMenuLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [menuReload])

  useEffect(() => {
    const syncPageWithHash = () => {
      setActivePage(window.location.hash === '#admin' ? 'admin' : 'order')
    }

    window.addEventListener('hashchange', syncPageWithHash)
    return () => window.removeEventListener('hashchange', syncPageWithHash)
  }, [])

  const cartDetails = cart.map((entry) => {
    const menu = menuItems.find((item) => item.id === entry.menuId)
    if (!menu) return null
    const selected = menu.options.filter((option) => entry.optionIds.includes(option.id))
    const unitPrice = menu.price + selected.reduce((sum, option) => sum + option.price, 0)

    return { ...entry, menu, selected, unitPrice, lineTotal: unitPrice * entry.quantity }
  }).filter(Boolean)

  const total = cartDetails.reduce((sum, entry) => sum + entry.lineTotal, 0)
  const itemCount = cartDetails.reduce((sum, entry) => sum + entry.quantity, 0)

  const toggleOption = (menuId, optionId) => {
    setSelectedOptions((current) => {
      const currentOptions = current[menuId] ?? []
      const nextOptions = currentOptions.includes(optionId)
        ? currentOptions.filter((id) => id !== optionId)
        : [...currentOptions, optionId]

      return { ...current, [menuId]: nextOptions }
    })
  }

  const retryMenus = () => {
    setMenuLoading(true)
    setMenuError('')
    setMenuReload((current) => current + 1)
  }

  const addToCart = (menu) => {
    const optionIds = [...(selectedOptions[menu.id] ?? [])].sort()
    const key = `${menu.id}:${optionIds.join(',')}`
    orderRequestKey.current = null

    setCart((current) => {
      const existing = current.find((entry) => entry.key === key)
      if (existing) {
        return current.map((entry) =>
          entry.key === key ? { ...entry, quantity: entry.quantity + 1 } : entry,
        )
      }

      return [...current, { key, menuId: menu.id, optionIds, quantity: 1 }]
    })
    setNotice({ type: 'success', text: `${menu.name}을(를) 장바구니에 담았어요.` })
  }

  const placeOrder = async () => {
    if (cart.length === 0 || isSubmitting) return

    if (!orderRequestKey.current) orderRequestKey.current = crypto.randomUUID()
    setIsSubmitting(true)
    setNotice(null)

    try {
      await apiRequest('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': orderRequestKey.current },
        body: JSON.stringify({
          items: cart.map(({ menuId, quantity, optionIds }) => ({ menuId, quantity, optionIds })),
        }),
      })
      setCart([])
      setSelectedOptions({})
      orderRequestKey.current = null
      setNotice({ type: 'success', text: '주문이 접수됐어요. 맛있게 준비해 드릴게요!' })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="COZY 홈">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32">
              <path d="M7 12h17v7a7 7 0 0 1-7 7h-3a7 7 0 0 1-7-7z" />
              <path d="M24 14h2a3 3 0 0 1 0 6h-3M11 7c-1-2 2-2 1-4M17 7c-1-2 2-2 1-4" />
            </svg>
          </span>
          <span>COZY<span className="brand-period">.</span></span>
        </a>

        <nav className="main-nav" aria-label="주요 메뉴">
          <a
            className={`nav-link${activePage === 'order' ? ' nav-link--active' : ''}`}
            href="#menu"
            aria-current={activePage === 'order' ? 'page' : undefined}
          >
            주문하기
          </a>
          <a
            className={`nav-link${activePage === 'admin' ? ' nav-link--active' : ''}`}
            href="#admin"
            aria-current={activePage === 'admin' ? 'page' : undefined}
          >
            관리자
          </a>
        </nav>

        {activePage === 'order' ? (
          <a className="header-cart" href="#cart" aria-label={`장바구니, ${itemCount}개 항목`}>
            <CartIcon />
            <span>장바구니</span>
            <span className="header-cart-count">{itemCount}</span>
          </a>
        ) : (
          <span className="admin-header-label">매장 관리</span>
        )}
      </header>

      {activePage === 'admin' ? (
        <AdminDashboard />
      ) : (
        <main>
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> 오늘도, 커피 한 잔의 여유</p>
            <h1 id="page-title">좋은 하루는<br /><span>좋은 커피</span>로부터</h1>
            <p className="intro-description">취향에 맞는 커피를 고르고, 나만의 옵션을 더해보세요.</p>
            <a className="intro-link" href="#menu">메뉴 둘러보기 <span aria-hidden="true">↓</span></a>
          </div>
          <div className="intro-art" aria-hidden="true">
            <div className="intro-art-orbit" />
            <div className="intro-bean intro-bean--one" />
            <div className="intro-bean intro-bean--two" />
            <div className="intro-cup">
              <div className="intro-cup-coffee"><span /></div>
              <div className="intro-cup-handle" />
              <div className="intro-cup-logo">C.</div>
              <div className="intro-cup-saucer" />
            </div>
            <span className="intro-spark intro-spark--one">✳</span>
            <span className="intro-spark intro-spark--two">✦</span>
          </div>
          <div className="intro-note"><span>☕</span> 매일 아침, 신선하게</div>
        </section>

        <section className="menu-section" id="menu" aria-labelledby="menu-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">COZY COFFEE</p>
              <h2 id="menu-title">오늘의 커피</h2>
            </div>
            <p className="menu-count"><span>{menuItems.length}</span>가지 메뉴</p>
          </div>

          <div className="menu-grid">
            {menuLoading ? (
              <p className="menu-feedback" role="status">메뉴를 불러오는 중입니다.</p>
            ) : menuError ? (
              <div className="menu-feedback" role="alert">
                <p>메뉴를 불러오지 못했습니다. {menuError}</p>
                <button type="button" onClick={retryMenus}>다시 시도</button>
              </div>
            ) : menuItems.length === 0 ? (
              <p className="menu-feedback" role="status">현재 주문 가능한 메뉴가 없습니다.</p>
            ) : menuItems.map((menu) => {
              const presentation = menuPresentation[menu.name] ?? {
                englishName: menu.name,
                art: 'latte',
              }
              const chosenOptions = selectedOptions[menu.id] ?? []

              return (
                <article className="menu-card" key={menu.id}>
                  <div className={`menu-art menu-art--${presentation.art}`}>
                    {menu.imageUrl ? (
                      <img className="menu-photo" src={menu.imageUrl} alt={menu.name} />
                    ) : (
                      <CoffeeArtwork art={presentation.art} id={menu.id} />
                    )}
                    {presentation.badge && <span className="menu-badge">{presentation.badge}</span>}
                  </div>
                  <div className="menu-card-content">
                    <div className="menu-name-row">
                      <div>
                        <p className="menu-english-name">{presentation.englishName}</p>
                        <h3>{menu.name}</h3>
                      </div>
                      <span className="menu-price">{formatPrice(menu.price)}</span>
                    </div>
                    <p className="menu-description">{menu.description}</p>

                    <fieldset className="option-list" disabled={isSubmitting}>
                      <legend>옵션 선택</legend>
                      {menu.options.map((option) => (
                        <label className="option-row" key={option.id}>
                          <input
                            type="checkbox"
                            checked={chosenOptions.includes(option.id)}
                            onChange={() => toggleOption(menu.id, option.id)}
                          />
                          <span className="custom-checkbox" aria-hidden="true">
                            <svg viewBox="0 0 12 10"><path d="m1 5 3.2 3L11 1" /></svg>
                          </span>
                          <span className="option-name">{option.name}</span>
                          <span className="option-price">{option.price > 0 ? `+${formatPrice(option.price)}` : '+0원'}</span>
                        </label>
                      ))}
                    </fieldset>

                    <button className="add-button" type="button" disabled={isSubmitting} onClick={() => addToCart(menu)}>
                      <span className="add-icon" aria-hidden="true">+</span>
                      장바구니 담기
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="cart-section" id="cart" aria-labelledby="cart-title">
          <div className="cart-main">
            <div className="cart-heading">
              <div className="cart-icon-wrap"><CartIcon /></div>
              <div>
                <h2 id="cart-title">장바구니</h2>
                <p>{itemCount > 0 ? `${itemCount}개의 메뉴를 담았어요` : '주문할 메뉴를 담아주세요'}</p>
              </div>
            </div>

            {notice && (
              <p className={`order-notice order-notice--${notice.type}`} role="status" aria-live="polite">
                <span aria-hidden="true">{notice.type === 'success' ? '✓' : '!'}</span>{notice.text}
              </p>
            )}

            {cartDetails.length > 0 ? (
              <ul className="cart-items">
                {cartDetails.map((entry) => (
                  <li className="cart-item" key={entry.key}>
                    <div className="cart-item-info">
                      <span className="cart-item-name">{entry.menu.name}</span>
                      <span className="cart-item-options">
                        {entry.selected.length > 0
                          ? entry.selected.map((option) => option.name).join(' · ')
                          : '기본'}
                      </span>
                    </div>
                    <span className="cart-item-quantity">× {entry.quantity}</span>
                    <span className="cart-item-price">{formatPrice(entry.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-cart">
                <span className="empty-cart-icon"><CartIcon /></span>
                <p>아직 담긴 메뉴가 없어요.</p>
                <span>마음에 드는 커피를 골라보세요.</span>
              </div>
            )}
          </div>

          <aside className="cart-checkout" aria-label="주문 금액">
            <div className="checkout-line">
              <span>상품 수</span>
              <span>{itemCount}개</span>
            </div>
            <div className="checkout-line">
              <span>총 금액</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <button className="checkout-button" type="button" disabled={itemCount === 0 || isSubmitting} onClick={placeOrder}>
              {isSubmitting ? '주문 접수 중' : '주문하기'} <span aria-hidden="true">→</span>
            </button>
            <p className="checkout-caption">주문 접수 후 매장에서 준비해 드려요</p>
          </aside>
        </section>
        </main>
      )}

      <footer className="site-footer">
        <a className="footer-brand" href="#">COZY<span>.</span></a>
        <span>오늘도 여유로운 한 잔, COZY COFFEE</span>
        <span>© 2026 COZY COFFEE</span>
      </footer>
    </div>
  )
}

export default App
