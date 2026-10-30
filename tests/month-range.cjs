// Run with node tests/month-range.cjs. No live network or database writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const edge=fs.readFileSync(path.join(root,'supabase/functions/vehicle-log-admin/index.ts'),'utf8');
const extract=s=>s.slice(s.indexOf('function reportMonthRange('),s.indexOf('\n}',s.indexOf('function reportMonthRange('))+2);
const fixtures=[['2026-02','2026-03-01',28],['2028-02','2028-03-01',29],['2026-04','2026-05-01',30],['2026-10','2026-11-01',31],['2026-12','2027-01-01',31]];
for(const tz of ['UTC','Asia/Seoul','America/Los_Angeles']){
  process.env.TZ=tz;
  for(const source of [app,edge]){
    const ctx=vm.createContext({});vm.runInContext(extract(source),ctx);
    for(const [month,next,days] of fixtures){
      const range=ctx.reportMonthRange(month),start=Date.parse(range.start),end=Date.parse(range.end);
      assert.equal(end,Date.parse(next+'T00:00:00+09:00'));
      assert.equal((end-start)/86400000,days);
      const included=t=>t>=start&&t<end;
      assert(!included(start-1));assert(included(start));assert(included(end-1));assert(!included(end));
    }
    for(const month of ['2026-00','2026-13','2026-1','bad'])assert.throws(()=>ctx.reportMonthRange(month));
  }
}
// Run the actual Edge request handler with a read-only Supabase stub.
let handler,filters=[];
const admin={auth:{getUser:async()=>({data:{user:{id:'u'}}})},from(table){
  const chain={select(){return this},eq(){return this},in(){return this},is(){return this},order(){return this},
    gte(k,v){filters.push(['gte',k,v]);return this},lt(k,v){filters.push(['lt',k,v]);return this},
    maybeSingle:async()=>({data:table==='profiles'?{role:'superadmin'}:{id:'v',facility_id:'f'}}),
    then(resolve,reject){return Promise.resolve({data:table==='profiles'?[{id:'u',facility_id:'f'}]:table==='facilities'?[{id:'f'}]:[]}).then(resolve,reject)}
  };return chain;
}};
const ctx=vm.createContext({Request,Response,createClient:()=>admin,Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn}});
vm.runInContext(edge.replace(/^import .*\n/,'').replace('authChanges:any','authChanges'),ctx);
(async()=>{
  for(const [month,next] of fixtures){
    filters=[];
    const response=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({action:'report',vehicleId:'v',month})}));
    assert.equal(response.status,200);
    assert.equal(Date.parse(filters.find(x=>x[0]==='lt')[2]),Date.parse(next+'T00:00:00+09:00'));
    assert.equal(filters.find(x=>x[0]==='gte')[2],month+'-01T00:00:00+09:00');
  }
  for(const month of ['2026-00','2026-13']){
    const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({action:'report',vehicleId:'v',month})}));
    assert.equal(response.status,400);
  }
  // Ensure both facility-admin query paths use the same tested range.
  assert.equal((app.match(/const \{start,end\}=reportMonthRange\(month\)/g)||[]).length,2);
  assert(!app.includes('endDate.setMonth'));
  console.log('PASS: 3 timezones, leap/non-leap February, 30/31-day months, year rollover, exact boundaries, invalid months and Edge report filters');
})().catch(e=>{console.error(e);process.exitCode=1});

