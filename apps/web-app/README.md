# Web App (LLM Wiki) 실행 방법

## 로컬 실행
```bash
cd apps/web-app
npm install
npm run dev
```

## 현재 동작
- Settings에서 GitHub `owner/repo/branch/token` + `sourcePath/wikiPath/backupPath` 설정
- 앱 시작 시 자동 동기화(startup sync, server-wins)
- 수동 `Sync (Server Wins)` 버튼 지원
- 동기화 전 로컬 스냅샷 백업(메모리) 생성
- Files 화면에서 source + wiki 폴더 문서 동시 탐색
- Graph 화면에서 wiki 폴더 대상 링크 그래프(텍스트 MVP) 표시

## 서버 우선 동기화 정책
- 앱 시작/리로드/수동 Sync 시 서버 데이터를 정본으로 간주하여 로컬 상태를 교체합니다.
