# 정식 배포 전 초기화 검증

## 2026-10-18 확인 결과

- 기준 main: `b974ad2b44b71bb3550084e7dc345e0a486d9716`.
- 실제 Supabase 프로젝트: `ibxckzjregbbtqwjitwj` (VehicleLogBook).
- 조회 당시 운행 1건(운행 중 0), 정비 0건, 차량 8대, 직원 3명, 차량 관리 담당자 지정 0건. 시설 12개, profiles 11개.
- 운행 1건에 차량·운전자·동승자 참조가 있어 차량·직원 초기화 모두 차단되는 상태다. 데이터 건수는 이후 바뀔 수 있다.
- 실제 `reset_vehicle_log_master_data(text)`의 본문·잠금·권한 설정이 저장소 SQL과 일치한다. SECURITY INVOKER이며 anon/authenticated 실행 불가, service_role 실행 가능이다. 네 데이터 테이블 모두 RLS 활성 상태다.
- 실제 `vehicle-log-admin`은 ACTIVE, v14, verify_jwt=true이고 조회한 배포 소스는 수정 전 저장소 소스와 정확히 일치했다. resetVehicles/resetMembers 분기가 이미 포함돼 있다.
- 운영 DB에서는 SELECT와 카탈로그 조회만 했다. 삭제 RPC, 운행 초기화, 테스트 데이터 삽입, 스키마 변경, 재배포는 하지 않았다.

## 참조 관계와 보호 조건

| 참조 | 실제 DB 동작 | 초기화 함수의 추가 보호 |
|---|---|---|
| trips.vehicle_id → vehicles.id | 기본 NO ACTION | 연결 운행이 있으면 차량 초기화 거절 |
| trips.driver_id → facility_members.id | 기본 NO ACTION | 연결 운행이 있으면 직원 초기화 거절 |
| trips.passenger_ids[] → 직원 ID | 배열이므로 FK 없음 | ANY(passenger_ids) 검사로 동승자만 연결된 직원도 보호 |
| vehicle_maintenance.vehicle_id → vehicles.id | ON DELETE CASCADE | 정비가 있으면 차량 초기화 거절, 연쇄 삭제 방지 |
| vehicles.(manager_member_id,facility_id) → facility_members.(id,facility_id) | 담당자 ID만 SET NULL | 담당자 지정이 있으면 직원 초기화 거절 |
| vehicle_maintenance.created_by → auth.users.id | ON DELETE SET NULL | 직원 명부가 아니라 인증 사용자 참조이므로 직원 초기화와 별개 |

함수는 네 테이블에 SHARE ROW EXCLUSIVE 잠금을 잡은 동일 트랜잭션에서 검사·삭제한다. 다른 쓰기와의 경합 시 최대 5초 후 잠금 오류가 발생할 수 있으며 Edge는 409로 안내한다. 잠금은 각 호출 동안만 유지되므로 초기화 단계 사이에 새 운행·정비가 생기면 다음 단계가 다시 차단된다.

## 승인 후 실행할 안전한 순서

1. 직원 입력과 관리자 편집을 잠시 중단하고 `database/reset_preflight.sql`로 현황을 다시 조회한다. 필요한 운행·정비·차량·직원 내역을 내보내 보관한다. Excel 출력은 원상 복구용 DB 백업과 다르므로 복원이 필요하면 별도 DB 백업도 확보한다.
2. 최고관리자의 **운행 데이터 초기화**로 운행기록을 정리한다. 운행 중인 기록도 전체 삭제 대상이므로 먼저 확인한다. 정비이력은 지워지지 않는다.
3. 정비가 남아 있으면 **정비 이력 → 전체 차량 → Excel 다운로드**로 보관한 뒤, 삭제 승인을 받은 이력만 화면의 개별 삭제로 정리한다. 일괄 정비 초기화 버튼은 없다. 대량 정리가 필요하면 승인된 범위의 별도 작업으로 계획한다. 차량을 직접 DELETE하거나 CASCADE를 이용해 정비를 우회 삭제하지 않는다.
4. **차량 초기화**를 누르고 `차량 초기화`를 입력한다. 시설 필터와 무관하게 전체 시설 차량이 대상이다.
5. **직원 초기화**를 누르고 `직원 초기화`를 입력한다. 전체 시설 직원 명부가 대상이며 관리자 로그인 계정 삭제가 아니다.
6. 운행·정비·차량·직원 0건과 시설·관리자·운행목적 설정 보존을 확인하고 필요한 실데이터를 다시 등록한다.

현재 조회 상태에서는 3번 정비 삭제가 필요 없다. 차량을 유지하고 직원만 정리하려면 연결 운행을 먼저 처리하고 모든 차량의 관리 담당자 지정을 해제하면 된다. 반대로 정비이력을 보존해야 한다면 해당 차량의 초기화를 중단해야 한다.

## SQL·Edge·프런트 배포 조건

- 같은 프로젝트에 `database/vehicle_details.sql`의 차량 담당자 컬럼 및 복합 FK와 정비 테이블이 있어야 한다. 이미 적용된 차량 기본정보 SQL을 중복 실행하지 않는다.
- `database/reset_master_data.sql` 전체를 적용해야 한다. 함수 생성뿐 아니라 마지막 REVOKE/GRANT도 포함한다. service_role에 대상 네 테이블의 조회·삭제 및 잠금에 필요한 권한이 있어야 한다. anon/authenticated에는 RPC 실행권을 부여하지 않는다.
- Edge에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 키는 서버 환경변수로만 관리한다. 값 자체는 이번 검증에서 열람하지 않았다.
- 현재 구조는 verify_jwt=true와 사용자 access_token을 사용한다. Edge 안에서 getUser(token) 및 profiles.role==='superadmin'을 재확인한다. anon 키만 전달하거나 일반 시설 관리자 세션으로 호출하면 허용되지 않는다.
- 차량/직원 초기화 요청에는 각각 정확한 confirmation 문자열이 필요하다. 잘못된 문구는 400, 인증 실패는 401, 권한 부족은 403, 연결기록·잠금 경합은 409다. RPC 미배포·권한 문제 등은 500이므로 SQL과 Edge 로그를 확인한다.
- 현재 SQL과 새 초기화 분기는 이미 배포돼 있다. 이번 수정은 기존 resetTrips 완료 건수 산정만 바꾸므로 SQL 재적용은 필요 없다. **수정된 정확한 건수 표시는 변경 코드를 반영한 Edge 재배포 후 적용된다.** GitHub 커밋만으로 Supabase 함수가 자동 갱신되지는 않는다.
- 프런트의 API URL이 동일 프로젝트를 가리키고 최신 app.js를 로드해야 한다. 이번 수정은 Edge 전용이어서 프런트 변경은 없다.

## 발견한 결함과 수정

기존 resetTrips는 DELETE 후 select('id') 응답 배열 길이를 완료 건수로 사용했다. PostgREST 반환 행 제한을 넘으면 실제 삭제 건수보다 적게 표시할 수 있어, `.delete({count:'exact'})`의 count로 변경했다. 삭제 대상과 인증 로직은 동일하다. 서버 mock에서 2,501건 반환 및 오류 경로를 확인했다. 운영 Edge는 아직 v14이므로 이 표시 수정은 미배포 상태다.

## 재현 가능한 검증

- `node tests/reset-master-data.cjs`: 화면 노출, 역할 검사, 취소·확인 문구, 새 초기화 RPC, 캐시 초기화, 오류 복구, 서버 401/403/400/409/500 및 운행 삭제 건수.
- `tests/reset-master-sql.cjs`: @electric-sql/pglite@0.3.14를 임시 경로에 설치하고 NODE_PATH를 해당 node_modules로 지정해 실행한다. 실제 저장소 SQL을 메모리 PostgreSQL에 그대로 로드하고 운전자·동승자·정비·담당자 차단, 오류 시 보존, 초기화 순서, 전체 건수, 0건 재실행, 시설/계정/목적 보존, 실행권 제한 등 13개 시나리오를 검증한다. 최소 테이블 구조의 격리 테스트이며 운영 DB 전체 복제는 아니다.
- 기존 regression, vehicle-info, report-editor(17/17) 테스트도 통과했다.
- SQL의 잠금 구문과 운영 정의는 확인했지만 실제 다중 세션 경합 테스트는 하지 않았다. 실제 최고관리자 로그인부터 성공 삭제까지의 운영 E2E는 삭제 승인 전에는 수행하지 않았다.

공식 배포·환경변수 참고: https://supabase.com/docs/guides/functions/deploy , https://supabase.com/docs/guides/functions/secrets
