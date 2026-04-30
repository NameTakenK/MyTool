# MyTool Notes

Obsidian 스타일의 워크플로우를 참고한 Electron 기반 Markdown 노트 앱입니다.

## 주요 기능
- Vault(폴더) 열기
- GitHub 저장소 URL 입력 후 연동 (clone/pull)
- 문서 생성 시 항상 `.md` 파일 생성
- 문서 저장/생성 시 자동 git commit + push 시도
- Markdown 파일 트리 탐색 (`.md`)
- 에디터 + 실시간 프리뷰 분할 화면

## 실행
```bash
npm install
npm run start
```

## 포터블 실행
```bash
npm run start:portable
```

## GitHub 연동 방법
1. 상단 입력창에 `https://github.com/<owner>/<repo>.git` 입력
2. `Connect GitHub` 클릭
3. 이후 `New Note`로 만든 문서는 `.md`로 생성됨
4. 저장 시 자동으로 commit/push 시도

> 주의: private repo는 로컬 git 인증(SSH key/PAT)이 먼저 설정되어야 push 됩니다.

## Android 앱 (동일 워크플로우)
`android/` 폴더에 동일한 흐름의 Android 앱을 추가했습니다.
- Vault 폴더 선택
- `.md` 파일 목록/검색
- 새 문서 생성 시 `.md` 강제
- 문서 편집/저장 + 실시간 프리뷰
- GitHub URL 입력 UI (안드로이드는 로컬 vault 중심, git 동기화는 확장 포인트)

실행(Android Studio):
1. Android Studio에서 `android/` 폴더 열기
2. Gradle Sync
3. `app` 실행
