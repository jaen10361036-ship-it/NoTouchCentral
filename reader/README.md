# NoTouchCC Reader 1단계

권역별로 서로 다른 Chromium 사용자 프로필을 사용해 로그인 세션이 섞이지 않도록 구성합니다.

## 최초 1회

```powershell
npm install
npx playwright install chromium
npm run reader:setup
npm run reader
```

`npm run reader`를 실행하면 권역별 Chromium 창 4개가 열립니다. 새 프로필에는 자동 로그인을 시도하고, 이후에는 저장된 세션을 계속 사용합니다. 로그인 화면 구조가 달라 자동 로그인이 실패하면 해당 창에서 한 번 수동 로그인해도 프로필에 저장됩니다.

## 동작

- 권역별 독립 프로필 4개
- 60초마다 로그인 유지 여부 확인
- 로그인이 풀린 권역만 자동 재로그인
- 30초마다 현재 화면 HTML/스크린샷 저장
- `Ctrl + C`로 안전 종료

이번 단계는 로그인 유지와 실제 화면 구조 수집용입니다. 저장된 `reader/snapshots/*/latest.json`, HTML, PNG를 기준으로 다음 단계에서 세트·팀미션·리워드 파서를 정확히 연결합니다.
