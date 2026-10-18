// Run with node tests/reset-master-data.cjs. No live requests or deletions.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const elements={app:{innerHTML:''},toast:{textContent:'',classList:{add(){},remove(){}}}};
const button={disabled:false};
const ctx=vm.createContext({console,URLSearchParams,TextEncoder,Blob,URL,setTimeout(){},
  location:{search:''},localStorage:{getItem(){return null}},
  document:{getElementById:id=>elements[id],querySelectorAll:()=>[button]},
  confirm:()=>true,prompt:()=>'',fetch(){throw Error('Live requests forbidden');}});
ctx.window=ctx;
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);

(async()=>{
  run(`state.admin={profile:{role:'admin'},facility:{code:'HQ',name:'시설'}};
    callAdminApi=async p=>{window.sent=p;return {deletedCount:3}};
    renderAdminHome=async()=>{window.refreshed=true};`);
  run('adminFrame("")');assert(!elements.app.innerHTML.includes('resetAllMasterData'));
  await ctx.resetAllMasterData('members');assert.equal(ctx.sent,undefined);
  run("state.admin.profile.role='superadmin';adminFrame('')");
  assert(elements.app.innerHTML.includes('차량 초기화'));
  assert(elements.app.innerHTML.includes('직원 초기화'));
  assert(elements.app.innerHTML.includes('resetAllTripData()'));
  ctx.confirm=()=>false;
  await ctx.resetAllMasterData('vehicles');assert.equal(ctx.sent,undefined);
  ctx.confirm=()=>true;ctx.prompt=()=> '초기화';
  await ctx.resetAllMasterData('members');assert.equal(ctx.sent,undefined);
  for(const [kind,action,label] of [['vehicles','resetVehicles','차량'],['members','resetMembers','직원']]){
    ctx.prompt=()=>label+' 초기화';ctx.refreshed=false;
    await ctx.resetAllMasterData(kind);
    assert.equal(ctx.sent.action,action);assert.equal(ctx.sent.confirmation,label+' 초기화');
    assert(ctx.refreshed);assert.equal(button.disabled,false);
  }
  run("callAdminApi=async()=>{throw Error('연결된 운행기록이 있습니다.')} ");
  await ctx.resetAllMasterData('members');
  assert.equal(elements.toast.textContent,'연결된 운행기록이 있습니다.');
  assert.equal(button.disabled,false);assert.equal(run('masterDataResetPending'),false);

  let handler,role='superadmin',validUser=true,rpcCalls=0,rpcError=null,deleteCalls=0,deleteError=null;
  const edge=vm.createContext({Response,console,Deno:{env:{get:()=> 'test'},serve:fn=>handler=fn},
    createClient:()=>({auth:{getUser:async()=>({data:{user:validUser?{id:'u'}:null},error:null})},
      from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{role},error:null})})}),
        delete:options=>{deleteCalls++;assert.equal(table,'trips');assert.equal(options.count,'exact');
          return {not:async(column,op,value)=>{assert.equal(column,'id');assert.equal(op,'is');assert.equal(value,null);
            return {count:2501,error:deleteError};}};}}),
      rpc:async(name,args)=>{rpcCalls++;assert.equal(name,'reset_vehicle_log_master_data');assert(['vehicles','members'].includes(args.p_kind));return {data:3,error:rpcError};}})});
  vm.runInContext(fs.readFileSync(path.join(root,'supabase/functions/vehicle-log-admin/index.ts'),'utf8')
    .replace(/^import .*;\n/,'').replace('authChanges:any','authChanges'),edge);
  const request=body=>({method:'POST',headers:new Headers({Authorization:'Bearer test'}),json:async()=>body});
  validUser=false;assert.equal((await handler(request({action:'resetMembers'}))).status,401);
  validUser=true;role='admin';assert.equal((await handler(request({action:'resetMembers'}))).status,403);
  role='superadmin';assert.equal((await handler(request({action:'resetMembers',confirmation:'초기화'}))).status,400);
  assert.equal(rpcCalls,0);
  for(const [action,confirmation] of [['resetMembers','직원 초기화'],['resetVehicles','차량 초기화']]){
    const response=await handler(request({action,confirmation}));
    assert.equal(response.status,200);assert.equal((await response.json()).deletedCount,3);
  }
  rpcError={code:'23503',message:'연결된 기록이 있습니다.'};
  assert.equal((await handler(request({action:'resetVehicles',confirmation:'차량 초기화'}))).status,409);
  rpcError={code:'55P03'};
  const busy=await handler(request({action:'resetMembers',confirmation:'직원 초기화'}));
  assert.equal(busy.status,409);assert((await busy.json()).error.includes('다른 작업'));
  rpcError={code:'PGRST202',message:'missing function'};
  assert.equal((await handler(request({action:'resetMembers',confirmation:'직원 초기화'}))).status,500);
  validUser=false;assert.equal((await handler(request({action:'resetTrips'}))).status,401);
  validUser=true;role='admin';assert.equal((await handler(request({action:'resetTrips'}))).status,403);
  assert.equal(deleteCalls,0);role='superadmin';
  const trips=await handler(request({action:'resetTrips'}));
  assert.equal(trips.status,200);assert.equal((await trips.json()).deletedCount,2501);
  deleteError={message:'delete failed'};
  assert.equal((await handler(request({action:'resetTrips'}))).status,500);
  console.log('PASS: reset visibility, role checks, cancel/confirmation, independent actions, refresh, error recovery and server authorization');
})().catch(e=>{console.error(e);process.exitCode=1});
