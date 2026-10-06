// Run with node tests/regression.cjs. No live API requests or database writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const elements={app:{innerHTML:''},toast:{textContent:'',classList:{add(){},remove(){}}}};
const context=vm.createContext({console,URLSearchParams,TextEncoder,TextDecoder,Blob,URL,
  location:{search:''},localStorage:{getItem(){return null}},setTimeout(){},
  document:{getElementById:id=>elements[id]},fetch(){throw Error('Live network forbidden');}});
context.window=context;
vm.runInContext(fs.readFileSync(path.join(root,'vehicle-info.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
const run=code=>vm.runInContext(code,context);
const json=value=>JSON.parse(JSON.stringify(value));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!html.includes('\\n'));
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
assert.equal(scripts.length,3);
assert(scripts[0].includes('qrcode')&&scripts[1].includes('vehicle-info.js')&&scripts[2].includes('app.js'));
assert(fs.existsSync(path.join(root,scripts[0])));
vm.runInContext(fs.readFileSync(path.join(root,scripts[0]),'utf8'),context);
assert.equal(typeof context.QRCode.toCanvas,'function');
assert(elements.app.innerHTML.includes('관리자 로그인'));
assert(!elements.app.innerHTML.includes('화면을 불러오지 못했습니다'));

(async()=>{
  run('api=async payload=>{window.sent=payload};loadPublic=async()=>{};');
  elements.endKm={value:'150',min:'100'};
  elements.highpassCost={value:'5400'};elements.fuelCost={value:'70000'};
  for(const highpass of [false,true])for(const fuel of [false,true]){
    elements.highpassExpenseTab={getAttribute:()=>String(highpass)};
    elements.fuelExpenseTab={getAttribute:()=>String(fuel)};
    await context.endTrip('trip1');
    assert.deepEqual(json(context.sent),{action:'endTrip',tripId:'trip1',endOdometer:150,highpassCost:highpass?5400:null,fuelCost:fuel?70000:null});
  }
  for(const raw of ['', '99','-1','invalid']){
    context.sent=null;elements.endKm.value=raw;
    await context.endTrip('trip1');assert.equal(context.sent,null);
  }
  elements.endKm.value='150';
  for(const raw of ['', '-1','invalid']){
    context.sent=null;elements.fuelCost.value=raw;
    await context.endTrip('trip1');assert.equal(context.sent,null);
  }
  elements.fuelCost.value='0';await context.endTrip('trip1');assert.equal(context.sent.fuelCost,0);
  let pressed='true';
  elements.fuelExpenseTab={getAttribute:()=>pressed,setAttribute:(_,v)=>pressed=v,classList:{toggle(){}}};
  elements.fuelExpenseField={hidden:false,querySelector:()=>elements.fuelCost};
  context.toggleEndExpense('fuel');assert.equal(pressed,'false');assert.equal(elements.fuelCost.value,'');assert(elements.fuelExpenseField.hidden);

  run(`restRequest=async (url,opts)=>{window.request={url,opts};return [{vehicle_id:'v1',month_minutes:90,month_distance:12.5,total_minutes:120,total_distance:100}]};`);
  const metric=await run("loadVehicleUsageMetrics('2026-10')");
  assert.equal(context.request.url,'rpc/get_vehicle_usage_metrics');
  assert.deepEqual(JSON.parse(context.request.opts.body),{p_month:'2026-10'});
  assert(run(`usageMetricMarkup(${JSON.stringify(metric.v1)},'month')`).includes('1시간 30분'));
  assert(run(`usageMetricMarkup(${JSON.stringify(metric.v1)},'total')`).includes('100 km'));

  run(`state.admin={profile:{role:'admin',display_name:'테스트'},facility:{id:'f1',code:'TEST',name:'시설'},vehicles:[{id:'v1',facility_id:'f1',plate_number:'11가1111'},{id:'v2',facility_id:'f1',plate_number:'22나2222'}]};
    window.fixture=[{id:'m1',facility_id:'f1',vehicle_id:'v1',maintenance_date:'2026-10-01',item:"O'Brien 정비",cost:100,note:"기사's 메모"},{id:'m2',facility_id:'f1',vehicle_id:'v2',maintenance_date:'2026-10-02',item:'타이어',cost:200}];
    restRequest=async()=>window.fixture;`);
  await run('renderMaintenanceHistory()');
  assert.equal(run('state.maintenanceExportData.rows.length'),2);
  const handler=elements.app.innerHTML.match(/onclick="(editMaintenance\([^"]+)"/)[1];
  context.editMaintenance=(...args)=>context.edited=args;
  run(handler);assert.equal(context.edited[1],"O%27Brien%20%EC%A0%95%EB%B9%84");
  assert.equal(decodeURIComponent(context.edited[3]),"기사's 메모");
  run("state.maintenanceFilterVehicle='v1'");await run('renderMaintenanceHistory()');
  assert.equal(run('state.maintenanceExportData.rows.length'),1);
  assert(elements.app.innerHTML.includes('100원'));
  run("state.maintenanceFilterVehicle='removed'");await run('renderMaintenanceHistory()');
  assert.equal(run('state.maintenanceFilterVehicle'),'');assert.equal(run('state.maintenanceExportData.rows.length'),2);
  run(`state.admin.profile.role='superadmin';getOverview=async()=>({vehicles:state.admin.vehicles,facilities:[state.admin.facility]});`);
  await run('renderMaintenanceHistory()');assert(elements.app.innerHTML.includes('<th>시설</th>'));

  // Generate real ZIP/XLSX bytes for independent reader validation when requested.
  if(process.env.REGRESSION_XLSX_DIR){
    const dir=process.env.REGRESSION_XLSX_DIR;fs.mkdirSync(dir,{recursive:true});
    for(const master of [false,true]){
      const bytes=run(`buildMaintenanceXlsx(window.fixture,{v1:state.admin.vehicles[0],v2:state.admin.vehicles[1]},{f1:state.admin.facility},{isMaster:${master},totalCost:300})`);
      fs.writeFileSync(path.join(dir,`maintenance-${master}.xlsx`),bytes);
    }
    for(const highpass of [false,true])for(const fuel of [false,true]){
      const bytes=run(`buildMonthlyXlsx('2026-10',[{start_at:'2026-10-01T00:00:00Z',end_at:'2026-10-01T01:00:00Z',start_odometer:100,end_odometer:150,distance:50,highpass_cost:5400,fuel_cost:70000}],{plate_number:'11가1111'},{},{},'시설',{includeHighpass:${highpass},includeFuel:${fuel}})`);
      fs.writeFileSync(path.join(dir,`monthly-${highpass}-${fuel}.xlsx`),bytes);
    }
  }
  console.log('PASS: script order, QR library, login markup, trip costs/validation, usage metrics, maintenance filters/quotation handling and XLSX generation');
})().catch(error=>{console.error(error);process.exitCode=1;});
