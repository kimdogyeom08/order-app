# COZY COFFEE

React 주문·관리자 화면입니다. 메뉴와 옵션은 서버 API에서 읽고 주문, 재고 변경, 주문 상태 변경은 PostgreSQL에 저장됩니다. 주문 API가 성공한 경우에만 장바구니가 비워집니다.

화면 요구사항은 [주문하기 화면 PRD](../docs/PRD.md)를 참고하세요.

## 개발 서버 실행

```bash
npm install
npm run dev
```

주문 및 관리자 데이터를 사용하려면 먼저 `server/`에서 PostgreSQL 연결 설정 후 `npm run dev`로 API 서버를 시작합니다. Vite는 `/api` 요청을 `http://localhost:3000`으로 전달합니다.

## 검증

```bash
npm run lint
npm run build
```

API 설정과 실행 방법은 [서버 README](../server/README.md)를 참고하세요.
