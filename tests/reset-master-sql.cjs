// In-memory PostgreSQL only. No Supabase credentials, requests or production data.
// Install @electric-sql/pglite@0.3.14 in a temporary directory, then set NODE_PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create table facilities(id int primary key);
      create table profiles(id int primary key, facility_id int references facilities);
      create table trip_purposes(id int primary key);
      create table facility_members(id int primary key, facility_id int references facilities, unique(id,facility_id));
      create table vehicles(id int primary key, facility_id int references facilities, manager_member_id int,
        foreign key(manager_member_id,facility_id) references facility_members(id,facility_id) on delete set null(manager_member_id));
      create table trips(id int primary key, vehicle_id int references vehicles, driver_id int references facility_members, passenger_ids int[]);
      create table vehicle_maintenance(id int primary key, vehicle_id int references vehicles on delete cascade);
      grant usage on schema public to service_role;
      grant all on all tables in schema public to service_role;
    `);
    // Load the real production SQL, without rewriting its function body or ACL.
    await db.exec(fs.readFileSync(path.join(__dirname,'../database/reset_master_data.sql'),'utf8'));
    const seed = async () => db.exec(`reset role;
      truncate trips,vehicle_maintenance,vehicles,facility_members,profiles,facilities,trip_purposes;
      insert into facilities values(1),(2); insert into profiles values(1,1),(2,2);
      insert into trip_purposes values(1);
      insert into facility_members values(1,1),(2,1),(3,2);
      insert into vehicles values(1,1,null),(2,2,null); set role service_role;`);
    const counts = async () => (await db.query(`select
      (select count(*)::int from trips) trips,
      (select count(*)::int from vehicle_maintenance) maintenance,
      (select count(*)::int from vehicles) vehicles,
      (select count(*)::int from facility_members) members,
      (select count(*)::int from facilities) facilities,
      (select count(*)::int from profiles) profiles,
      (select count(*)::int from trip_purposes) purposes`)).rows[0];
    const reset = async kind => (await db.query('select public.reset_vehicle_log_master_data($1)::int as n',[kind])).rows[0].n;
    let passed=0;
    const blocked = async (kind,code,message) => {
      const before=await counts();
      await assert.rejects(reset(kind),e=>e.code===code&&(!message||e.message.includes(message)));
      assert.deepEqual(await counts(),before);passed++;
    };
    await seed();await blocked(null,'22023');await blocked('maintenance','22023');
    await db.exec('insert into trips values(1,1,1,array[2])');
    await blocked('vehicles','23503','운행');await blocked('members','23503','운행');
    // Passenger arrays have no FK: the explicit membership guard is essential.
    await db.exec('update trips set driver_id=null');await blocked('members','23503','운행');
    await seed();await db.exec('insert into vehicle_maintenance values(1,1)');
    await blocked('vehicles','23503','정비');
    await seed();await db.exec('update vehicles set manager_member_id=1 where id=1');
    await blocked('members','23503','담당자');
    await db.exec('update vehicles set manager_member_id=null where id=1');
    assert.equal(await reset('members'),3);passed++;
    // Authorized cleanup sequence on disposable fixtures only.
    await seed();await db.exec(`insert into trips values(1,1,1,array[2]);
      insert into vehicle_maintenance values(1,1);update vehicles set manager_member_id=1 where id=1;
      delete from trips;`);
    await blocked('vehicles','23503','정비');
    await db.exec('delete from vehicle_maintenance');
    assert.equal(await reset('vehicles'),2);assert.equal(await reset('members'),3);
    assert.deepEqual(await counts(),{trips:0,maintenance:0,vehicles:0,members:0,facilities:2,profiles:2,purposes:1});passed++;
    assert.equal(await reset('vehicles'),0);assert.equal(await reset('members'),0);passed++;
    for(const role of ['anon','authenticated']) {
      const before=await counts();
      await db.exec(`reset role;set role ${role}`);
      await assert.rejects(reset('vehicles'),e=>e.code==='42501');
      await db.exec('reset role;set role service_role');
      assert.deepEqual(await counts(),before);passed++;
    }
    console.log(`PASS: ${passed} SQL scenarios: invalid kind, driver/passenger/maintenance/manager guards, atomic rejection, all-facility counts, cleanup order, preserved settings and RPC ACL`);
  } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
