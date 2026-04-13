# MyTool

Electron 기반 유틸리티 앱입니다.

## 기능
- **Viewer**
  - diff / json / md 각각 분리된 입력/출력 영역
  - 파일 열기 시 확장자에 맞는 섹션으로 자동 입력
  - 입력창에 직접 타이핑 가능
- **Encode/Decode**: Base64, URL Encoding
- **Sync**: source 폴더를 target 폴더와 동일하게 미러링 (복수 작업 등록 가능)
- **UI**: 사이드바 내 기능 네비게이션 + 다크/라이트 테마
- **다국어**: 한국어/영어
- **입력 상태 저장**: 마지막 입력 및 설정 로컬 저장

## 실행
```bash
npm install
npm start
```

## 포터블 실행
- 별도 서버 없이 로컬에서 실행되는 Electron 데스크톱 앱입니다.
- 배포용 포터블 파일 생성은 `electron-builder` 같은 패키지를 추가해 설정할 수 있습니다.
