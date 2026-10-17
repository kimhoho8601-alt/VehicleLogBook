-- Called only by the authenticated superadmin Edge Function via service_role.
-- One transaction locks references as well as targets to prevent races.
CREATE OR REPLACE FUNCTION public.reset_vehicle_log_master_data(p_kind text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
SET lock_timeout = '5s'
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  IF p_kind IS NULL OR p_kind NOT IN ('vehicles', 'members') THEN
    RAISE EXCEPTION '초기화 항목을 확인해주세요.' USING ERRCODE = '22023';
  END IF;

  LOCK TABLE public.trips, public.vehicle_maintenance,
    public.vehicles, public.facility_members IN SHARE ROW EXCLUSIVE MODE;

  IF p_kind = 'vehicles' THEN
    IF EXISTS (SELECT 1 FROM public.trips t JOIN public.vehicles v ON v.id=t.vehicle_id) THEN
      RAISE EXCEPTION '연결된 운행기록이 있습니다. 먼저 운행 데이터 초기화를 진행해주세요.' USING ERRCODE = '23503';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vehicle_maintenance m JOIN public.vehicles v ON v.id=m.vehicle_id) THEN
      RAISE EXCEPTION '연결된 정비기록이 있습니다. 먼저 정비 이력을 정리해주세요.' USING ERRCODE = '23503';
    END IF;
    DELETE FROM public.vehicles;
  ELSE
    IF EXISTS (
      SELECT 1 FROM public.trips t JOIN public.facility_members m
      ON m.id=t.driver_id OR m.id=ANY(t.passenger_ids)
    ) THEN
      RAISE EXCEPTION '직원이 연결된 운행기록이 있습니다. 먼저 운행 데이터 초기화를 진행해주세요.' USING ERRCODE = '23503';
    END IF;
    IF EXISTS (SELECT 1 FROM public.vehicles v JOIN public.facility_members m ON m.id=v.manager_member_id) THEN
      RAISE EXCEPTION '차량 관리 담당자로 지정된 직원이 있습니다. 먼저 차량을 초기화하거나 담당자 지정을 해제해주세요.' USING ERRCODE = '23503';
    END IF;
    DELETE FROM public.facility_members;
  END IF;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_vehicle_log_master_data(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_vehicle_log_master_data(text) TO service_role;
