# VehicleLogBook 2.0

시설별 관리자 계정과 직원용 QR을 분리한 차량운행 기록 웹앱입니다.

## 구조
- 직원: `?facility=시설코드` QR로 접속, 차량/운행자/동승자/목적/행선지/키로수 입력, 운행 시작·종료
- 관리자: `?admin=1` 접속, 시설 ID/비밀번호 로그인
- 관리자 기능: 차량/직원/운행목적 관리, 현재 운행현황, 월+차량 기준 Excel 운행일지 출력
- DB/Auth: Supabase `VehicleLogBook`
- 직원용 데이터 접근: public Edge Function을 통해 시설 코드 범위로 제한
- 관리자 데이터 접근: Supabase Auth + RLS로 자기 시설 데이터만 접근

## 관리자 계정 규칙
관리자 화면에 입력하는 시설 ID가 `SEOUL01`이면 실제 Supabase Auth 이메일은 내부적으로 `seoul01@vehiclelog.local`을 사용합니다. Auth 사용자 생성 후 `profiles` 테이블에 동일 사용자 ID와 시설을 연결해야 합니다.

## 이전 버전
기존 Google Sheets / Apps Script 프로토타입은 `legacy-v1` 브랜치에 보관합니다.
