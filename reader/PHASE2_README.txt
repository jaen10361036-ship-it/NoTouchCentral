Reader Phase 2 - 홈 구조 수집 + 팀미션 1시간 유지

생성 파일:
- reader/cache/home-<권역키>.json : 권역별 홈 DOM/텍스트 진단 데이터
- reader/cache/home-all.json       : 4개 권역 통합 진단 데이터
- reader/cache/missions.json       : 화면에서 사라진 팀미션도 마지막 확인 시점부터 60분 유지

주의:
이 단계는 노터치CC 홈의 실제 DOM 구조를 안전하게 수집하는 발견 단계입니다.
세트/팀미션/리워드의 정확한 숫자 필드 매핑은 생성된 JSON을 확인한 뒤 다음 패치에서 고정합니다.
