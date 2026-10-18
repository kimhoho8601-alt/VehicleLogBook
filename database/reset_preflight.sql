-- Read-only. Run immediately before an approved reset; counts can change afterwards.
SELECT now() AS checked_at,
  (SELECT count(*) FROM public.trips) AS trips,
  (SELECT count(*) FROM public.trips WHERE status='active') AS active_trips,
  (SELECT count(*) FROM public.vehicle_maintenance) AS maintenance,
  (SELECT count(*) FROM public.vehicles) AS vehicles,
  (SELECT count(*) FROM public.facility_members) AS members,
  (SELECT count(*) FROM public.vehicles WHERE manager_member_id IS NOT NULL) AS assigned_managers,
  (SELECT count(*) FROM public.facilities) AS facilities,
  (SELECT count(*) FROM public.profiles) AS profiles;

SELECT conrelid::regclass AS source, confrelid::regclass AS target,
  conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE contype='f' AND (
  conrelid IN ('public.trips'::regclass,'public.vehicle_maintenance'::regclass,
    'public.vehicles'::regclass,'public.facility_members'::regclass)
  OR confrelid IN ('public.trips'::regclass,'public.vehicle_maintenance'::regclass,
    'public.vehicles'::regclass,'public.facility_members'::regclass));

SELECT p.oid::regprocedure AS signature, pg_get_functiondef(p.oid) AS definition,
  p.prosecdef AS security_definer, p.proacl AS permissions
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname='reset_vehicle_log_master_data';

SELECT has_function_privilege('anon','public.reset_vehicle_log_master_data(text)','EXECUTE') AS anon_execute,
  has_function_privilege('authenticated','public.reset_vehicle_log_master_data(text)','EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role','public.reset_vehicle_log_master_data(text)','EXECUTE') AS service_execute;
