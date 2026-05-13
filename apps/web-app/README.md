# Web App (LLM Wiki) 실행 방법

브라우저 기반 Obsidian-like LLM Wiki 클라이언트입니다.

## 기능(MVP)
- Markdown 문서 선택/렌더링
- 내부 링크 기반 Backlinks 계산
- Wiki Search 기반 Q&A (Vector DB 미사용)

## 요구 사항
- Node.js 20+
- npm 10+

## 로컬 실행
```bash
cd apps/web-app
npm install
npm run dev
```

실행 후 브라우저에서 Vite 기본 주소(보통 `http://localhost:5173`)로 접속합니다.

## 프로덕션 빌드
```bash
cd apps/web-app
npm install
npm run build
npm run preview
```

## 참고
- 현재 MVP는 샘플 문서 데이터로 동작합니다.
- 실제 GitHub 동기화/파일시스템 연동은 다음 단계에서 확장됩니다.
