-- Additive vehicle information; existing facility access policies remain unchanged.
alter table public.vehicles
  add column vehicle_type text,
  add column model_name text,
  add column model_year integer check (model_year between 1900 and 2100),
  add column acquired_on date,
  add column ownership_type text check (ownership_type in ('purchase','rent','lease','donation','other')),
  add column purchase_price numeric(14,2) check (purchase_price >= 0 and purchase_price <> 'NaN'::numeric),
  add column fuel_type text check (fuel_type in ('gasoline','diesel','lpg','hybrid','electric','hydrogen','other')),
  add column manager_member_id uuid,
  add column operating_status text not null default 'in_service' check (operating_status in ('in_service','maintenance','suspended','disposed')),
  add column contract_company text,
  add column monthly_fee numeric(14,2) check (monthly_fee >= 0 and monthly_fee <> 'NaN'::numeric),
  add column contract_start_on date,
  add column contract_end_on date,
  add column annual_mileage_limit integer check (annual_mileage_limit >= 0),
  add column donor_name text,
  add column donated_on date,
  add column appraised_value numeric(14,2) check (appraised_value >= 0 and appraised_value <> 'NaN'::numeric),
  add column insurance_expires_on date,
  add column inspection_due_on date,
  add column next_service_on date,
  add column next_service_odometer numeric(12,1) check (next_service_odometer >= 0 and next_service_odometer <> 'NaN'::numeric),
  add constraint vehicle_contract_date_order check (contract_end_on is null or contract_start_on is null or contract_end_on >= contract_start_on);

update public.vehicles set operating_status='suspended' where not is_active;

-- A selected manager must belong to the vehicle's facility, including API writes.
alter table public.facility_members add constraint members_id_facility_unique unique (id,facility_id);
alter table public.vehicles add constraint vehicle_manager_same_facility
  foreign key (manager_member_id,facility_id) references public.facility_members(id,facility_id)
  on delete set null (manager_member_id);
create index vehicles_manager_member_idx on public.vehicles(manager_member_id,facility_id) where manager_member_id is not null;

create function public.sync_vehicle_operating_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if TG_OP='UPDATE' and NEW.operating_status is not distinct from OLD.operating_status
    and NEW.is_active is distinct from OLD.is_active then
    NEW.operating_status := case when NEW.is_active then 'in_service' else 'suspended' end;
  end if;
  if NEW.operating_status <> 'in_service'
    and (TG_OP='INSERT' or NEW.operating_status is distinct from OLD.operating_status)
    and exists (select 1 from public.trips t where t.vehicle_id=NEW.id and t.status='active') then
    raise exception '운행 중인 차량입니다. 운행 종료 후 차량 상태를 변경해주세요.' using errcode='23514';
  end if;
  NEW.is_active := NEW.operating_status='in_service';
  return NEW;
end;
$$;
revoke all on function public.sync_vehicle_operating_status() from public;
create trigger sync_vehicle_operating_status before insert or update of operating_status,is_active
  on public.vehicles for each row execute function public.sync_vehicle_operating_status();
