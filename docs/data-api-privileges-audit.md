# Supabase Data API privileges audit — 2026-10-20

## Repository coverage

Inspected the full default-branch trees of all 14 accessible repositories, then examined application/documentation text for Supabase references and embedded SQL. Nine checked-in SQL files exist across VehicleLogBook, interview and teamleader. Scale is empty. Other branches are outside this audit; no AGENTS.md was found in the inspected trees.

| Repository | Data path | Finding / action |
| --- | --- | --- |
| VehicleLogBook | Staff: public Edge Function with facility scope; admin: authenticated REST + RLS; privileged reset: admin Edge Function → service_role RPC | No CREATE TABLE in its three SQL files. Keep table ACLs, RLS, reset validation and function ACLs unchanged. |
| interview | Direct REST under authenticated JWT; organization signup lists use anon | Four creation scripts depended on automatic grants. Updated to grant minimal operations only for tables actually created. Separate PR includes executable PostgreSQL tests and table matrix. |
| teamleader | Public clients call workshop RPCs; no direct table access | supabase.sql already enables RLS, revokes direct anon/authenticated table access and grants EXECUTE for declared RPCs. No new table grant needed. Keep security_setup.sql and host-key rotation untouched. |
| chatbot | Direct publishable-key client, no Supabase Auth login in inspected code; Realtime | Uses sck_tf_* tables, but no creation SQL in repo. Source recovery needed before a reproducible new project/preview. Do not add grants to unrelated current tables. |
| tree | RPC entry submission and public-view read | Table/view/RPC creation SQL absent. Recover definitions and view security before changing grants; do not grant anon directly on tree_workshop_entries. |
| family-tree | case-relation-api Edge Function | Server/table creation source absent. No browser table grant inferred from the public API. |
| main | main-visitor-api Edge Function | Server/table creation source absent. No browser table grant inferred from the public API. |
| fomhr, Work-Style, savethemove, photo, sign, Convert | No Supabase reference or CREATE TABLE found in inspected app text | No SQL change required. |
| Scale | Empty repository | Nothing to migrate. |

The accessible Supabase projects include VehicleLogBook and performance-management (active), plus teamleader and an older performance project (inactive). Inactive projects were not resumed or modified. No account credentials or user records were read.

## VehicleLogBook: preserved behavior

- `database/reset_master_data.sql` defines an existing-table reset RPC, not a table. `PUBLIC`, anon and authenticated execution remain revoked; service_role execution remains granted.
- `database/vehicle_details.sql` adds columns, a constraint, index and invoker trigger to existing tables. No table grant change is needed.
- `database/reset_preflight.sql` is read-only diagnostic SQL.
- Read-only catalog inspection of the active VehicleLogBook project confirmed RLS enabled on all current public tables. Reset RPC execution is false for anon/authenticated and true for service_role.
- Existing table ACLs include legacy grants (for example vehicle_maintenance grants to anon). RLS is a separate control: this finding alone does not establish public row access. No legacy ACL was tightened or expanded in this task, as requested.

Future VehicleLogBook table migrations must include RLS and explicit grants for the actual path: authenticated operations for admin REST; service_role operations only if the Edge Function uses that table through PostgREST; no anon table grant simply because staff can access the public Edge Function. Copy neither ALL TABLES nor default-privilege blanket grants. Database-owner/SECURITY DEFINER access is different from service-role REST access.

## Source gaps that must be addressed before rebuilding projects

The current operating databases contain tables/functions whose creation SQL is not in GitHub. Recover their original DDL/RLS/views/functions and check them into the owning repository before a new project or preview rebuild. Do not invent a schema or export secrets while doing this. In particular:

- interview's V5 organization/settings tables are missing from its V4.1 installer. Its audit document records the measured access matrix, including deliberate anon SELECT for signup lists.
- teamleader's application calls additional participant/reaction RPCs not declared in supabase.sql. Its base script is not a complete installer for current features.
- chatbot uses direct anon table operations. Future grants need its actual RLS rules, including editor/participant ownership. UI filters alone are not authorization.
- tree uses a view and RPCs. Verify view grants/security-invoker behavior and function authorization before deciding whether the underlying table needs any client grant.
- family-tree and main use Edge Functions; catalog inspection found their private data tables inaccessible to anon/authenticated at the table-grant layer. Preserve that server boundary.

## Apply vs. already checked

**No live permissions, schema, data, default privileges, RPCs or Edge Functions were changed.** GitHub changes alone do not update Supabase.

- Existing VehicleLogBook: no policy-change SQL to apply, and no reset/RPC redeploy needed for this task.
- Existing interview database: no blanket grant patch is needed for tables already accessible. Do not re-run the destructive V4→V4.1 migration merely for grants.
- New interview install / new calendar or employee table: use the corrected SQL creation path. Existing tables are skipped by its conditional ACL setup.
- New projects/previews of apps with missing SQL: pending source recovery, not certified by this audit.

## Verification

Ran VehicleLogBook's regression, report-editor, reset-master-data and reset-master-sql suites against local fixtures/disposable PostgreSQL. This includes actual reset SQL reference-blocking and privilege tests. Ran teamleader host-security tests. Interview's separate tests execute all four SQL scripts across fresh/upgrade and old/new privilege defaults, including existing-ACL preservation. No production reset or test records were created.

Reference: https://supabase.com/docs/guides/api/securing-your-api
