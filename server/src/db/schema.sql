CREATE TABLE IF NOT EXISTS menus (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  price INTEGER NOT NULL CHECK (price >= 0),
  image_url TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  menu_id BIGINT NOT NULL REFERENCES menus(id),
  name VARCHAR(120) NOT NULL,
  price INTEGER NOT NULL CHECK (price >= 0),
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (menu_id, name)
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'preparing', 'completed')),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_id BIGINT NOT NULL REFERENCES menus(id),
  menu_name_snapshot VARCHAR(120) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity >= 1),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0)
);

CREATE TABLE IF NOT EXISTS order_item_options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_item_id BIGINT NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id BIGINT NOT NULL REFERENCES options(id),
  option_name_snapshot VARCHAR(120) NOT NULL,
  option_price_snapshot INTEGER NOT NULL CHECK (option_price_snapshot >= 0)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_key VARCHAR(200) PRIMARY KEY,
  request_hash VARCHAR(64) NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_ordered_at_idx ON orders (ordered_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_item_options_item_id_idx ON order_item_options (order_item_id);

INSERT INTO menus (name, description, price, stock_quantity)
VALUES
  ('아메리카노 (ICE)', '산뜻한 산미와 깔끔한 여운의 시그니처 블렌드', 4000, 10),
  ('아메리카노 (HOT)', '고소한 원두의 풍미를 따뜻하게 즐겨보세요', 4000, 10),
  ('카페라떼', '에스프레소와 부드러운 우유의 밸런스', 5000, 10),
  ('바닐라 라떼', '은은한 바닐라 향이 더해진 달콤한 라떼', 5500, 4),
  ('콜드브루', '오랜 시간 차갑게 추출한 깊고 부드러운 커피', 4800, 0),
  ('카푸치노', '풍성한 우유 거품과 진한 에스프레소', 5000, 7)
ON CONFLICT (name) DO NOTHING;

UPDATE menus
SET image_url = CASE
  WHEN name = '아메리카노 (ICE)' THEN '/차가운.jpeg'
  WHEN name = '아메리카노 (HOT)' THEN '/아메리카노.jpeg'
  WHEN name = '카페라떼' THEN '/라떼.jpeg'
  WHEN name = '바닐라 라떼' THEN '/바닐라라떼.jpeg'
  WHEN name = '콜드브루' THEN '/콜드브루.jpeg'
  WHEN name = '카푸치노' THEN '/카푸치노.jpeg'
END
WHERE name IN ('아메리카노 (ICE)', '아메리카노 (HOT)', '카페라떼', '바닐라 라떼', '콜드브루', '카푸치노');

INSERT INTO options (menu_id, name, price)
SELECT menus.id, seed.name, seed.price
FROM menus
JOIN (VALUES
  ('아메리카노 (ICE)', '샷 추가', 500),
  ('아메리카노 (ICE)', '시럽 추가', 0),
  ('아메리카노 (HOT)', '샷 추가', 500),
  ('아메리카노 (HOT)', '시럽 추가', 0),
  ('카페라떼', '샷 추가', 500),
  ('카페라떼', '오트밀크 변경', 700),
  ('카페라떼', '시럽 추가', 0),
  ('바닐라 라떼', '샷 추가', 500),
  ('바닐라 라떼', '오트밀크 변경', 700),
  ('콜드브루', '샷 추가', 500),
  ('콜드브루', '시럽 추가', 0),
  ('카푸치노', '샷 추가', 500),
  ('카푸치노', '시럽 추가', 0)
) AS seed(menu_name, name, price) ON seed.menu_name = menus.name
ON CONFLICT (menu_id, name) DO NOTHING;