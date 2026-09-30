const SUPABASE_URL="https://ibxckzjregbbtqwjitwj.supabase.co";
const SUPABASE_KEY="sb_publishable_frUifOywlvlSly4Vcmsf8g_zbLzylQd";
const PUBLIC_API=SUPABASE_URL+"/functions/v1/vehicle-log-public";

const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const state={facilityCode:(qs.get("facility")||"").trim().toUpperCase(),data:null,selectedVehicle:null,passengers:new Set(),admin:null,adminTab:"dashboard",overview:null};

const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
async function api(payload){const r=await fetch(PUBLIC_API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({...payload,facilityCode:state.facilityCode})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"서버 연결에 실패했습니다.");return d}
const fmtTime=v=>v?new Date(v).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}):"";
const fmtDate=v=>v?new Date(v).toLocaleDateString("ko-KR"):"";

function userShell(body,title="차량 운행기록"){
  app.innerHTML=`<main class="shell"><header class="topbar"><div class="brand"><div class="brand-mark">VL</div><div class="brand-copy"><strong>VehicleLogBook</strong><span>${esc(title)}</span></div></div><button class="admin-link" onclick="location.href='?admin=1'">관리자</button></header>${body}<footer class="app-footer">안전한 이동, 정확한 기록</footer></main>`
}
async function loadPublic(){if(!state.facilityCode){userShell(`<section class="hero"><p class="eyebrow">VEHICLE LOGBOOK</p><h1>시설 QR로<br>접속해주세요.</h1><p>이 페이지는 시설별 QR 주소를 통해 사용합니다.</p></section><div class="empty">시설 코드가 없는 주소입니다.<br>관리자가 배포한 QR 또는 링크로 접속해주세요.</div>`);return}
try{const d=await api({action:"bootstrap"});state.data=d;renderVehicles()}catch(e){userShell(`<div class="empty">${esc(e.message)}</div>`,"연결 오류")}}

function renderVehicles(){
  const d=state.data;
  const cards=d.vehicles.map(v=>{
    const a=d.active?.[v.id];
    return `<button class="vehicle-card" onclick="selectVehicle('${v.id}')"><div class="vehicle-main"><span class="vehicle-dot"></span><div><div class="plate">${esc(v.plate_number)}</div><div class="label">${esc(v.label||d.facility.name)}</div>${a?`<div class="live-meta">${esc(a.driver_name)} · ${fmtTime(a.start_at)} 출발</div>`:""}</div></div><span class="status-chip ${a?"live":"ok"}">${a?"운행 중":"운행 가능"}</span></button>`;
  }).join("");
  userShell(`<section class="hero"><p class="eyebrow">${esc(d.facility.code)}</p><h1>${esc(d.facility.name)}</h1><p>사용할 차량을 선택하면 운행 기록을 바로 시작할 수 있습니다.</p></section><section class="safety-banner"><div class="safety-symbol">✓</div><div><strong>오늘도 안전운전</strong><p>출발 전 20초만 확인해 주세요. 차량 상태와 탑승 정보를 확인한 뒤 운행을 시작합니다.</p></div></section><section class="section-head"><div><span>차량 선택</span><strong>운행할 차량을 골라주세요</strong></div></section><section class="grid">${cards||'<div class="empty">등록된 차량이 없습니다.</div>'}</section>`,d.facility.name);
}

window.selectVehicle=function(id){state.selectedVehicle=id;state.passengers.clear();const v=state.data.vehicles.find(x=>x.id===id);const a=state.data.active?.[id];if(a)return renderEnd(v,a);renderStart(v)}
function renderStart(v){
  const members=state.data.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("");
  const purposes=state.data.purposes.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const chips=state.data.members.map(m=>`<button type="button" class="choice" data-passenger="${m.id}" onclick="togglePassenger(this)">${esc(m.name)}</button>`).join("");
  userShell(`<button class="back" onclick="renderVehicles()">← 차량 다시 선택</button>
  <section class="trip-heading"><div><p class="eyebrow">운행 시작</p><h1>${esc(v.plate_number)}</h1><p>운행 정보를 입력하고 출발 전 체크를 완료해주세요.</p></div><span class="status-chip ok">운행 가능</span></section>
  <section class="safety-check-card"><div class="safety-check-title"><span class="safety-number">20</span><div><strong>출발 전 20초 체크</strong><p>아래 항목을 모두 확인하면 운행 시작 버튼이 활성화됩니다.</p></div></div>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>차량 상태</strong><small>타이어·외관·계기판 경고등에 이상이 없습니다.</small></span></label>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>탑승 안전</strong><small>운전자·동승자를 확인하고 안전벨트를 착용했습니다.</small></span></label>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>출발 정보</strong><small>운행목적·행선지·출발 키로수를 확인했습니다.</small></span></label>
  </section>
  <div class="card form-card"><div class="card-head"><div><span class="card-kicker">운행 정보</span><h2>출발 기록 입력</h2></div><span class="required-note">필수 입력</span></div>
    <label class="field"><span>운행자</span><select id="driver" class="select"><option value="">운행자를 선택하세요</option>${members}</select></label>
    <div class="field"><span>동승자 <em>선택</em></span><div class="multi">${chips||'<span class="field-help">등록된 동승자가 없습니다.</span>'}</div></div>
    <label class="field"><span>운행목적</span><select id="purpose" class="select"><option value="">운행목적을 선택하세요</option>${purposes}</select></label>
    <label class="field"><span>행선지</span><input id="destination" class="input" placeholder="예: 서울중구청 / 방문 가정"></label>
    <label class="field"><span>출발 키로수 (km)</span><input id="startKm" class="input" type="number" min="${Number(state.data.lastOdometer?.[v.id]??0)}" step="0.1" inputmode="decimal" value="${state.data.lastOdometer?.[v.id]??""}" placeholder="예: 42351"></label>
    ${state.data.lastOdometer?.[v.id]!=null?`<p class="field-help odometer-help">이 차량의 이전 최종 키로수는 <strong>${Number(state.data.lastOdometer[v.id]).toLocaleString()} km</strong>입니다. 필요하면 더 큰 값으로 수정하세요.</p>`:""}
    <button id="startTripButton" class="btn primary" onclick="startTrip()" disabled>체크 완료 후 운행 시작</button>
  </div>`,state.data.facility.name);
}
window.togglePassenger=function(btn){const id=btn.dataset.passenger;state.passengers.has(id)?state.passengers.delete(id):state.passengers.add(id);btn.classList.toggle("active",state.passengers.has(id))}
window.updateSafetyReady=function(){
  const checks=[...document.querySelectorAll(".safety-check")];
  const ready=checks.length>0&&checks.every(x=>x.checked);
  const btn=document.getElementById("startTripButton");
  if(btn){
    btn.disabled=!ready;
    btn.textContent=ready?"운행 시작하기":"체크 완료 후 운행 시작";
  }
}
window.startTrip=async function(){
  const checks=[...document.querySelectorAll(".safety-check")];
  if(checks.some(x=>!x.checked))return toast("출발 전 체크사항을 모두 확인해주세요.");
  const driverId=document.getElementById("driver").value;
  const purposeId=document.getElementById("purpose").value;
  const destination=document.getElementById("destination").value.trim();
  const startOdometer=Number(document.getElementById("startKm").value);
  if(!driverId||!purposeId||!destination||!Number.isFinite(startOdometer))return toast("운행 정보를 모두 입력해주세요.");
  const btn=document.getElementById("startTripButton");
  if(btn){btn.disabled=true;btn.textContent="운행 시작 중...";}
  try{
    await api({action:"startTrip",vehicleId:state.selectedVehicle,driverId,passengerIds:[...state.passengers],purposeId,destination,startOdometer});
    toast("운행을 시작했습니다.");
    await loadPublic();
  }catch(e){
    toast(e.message);
    updateSafetyReady();
  }
}
function renderEnd(v,a){
  userShell(`<button class="back" onclick="renderVehicles()">← 차량 다시 선택</button>
  <section class="trip-live-banner"><div class="pulse-dot"></div><div><span>현재 운행 중</span><strong>${esc(v.plate_number)}</strong><p>${esc(a.driver_name)} · ${fmtTime(a.start_at)} 출발</p></div></section>
  <div class="card form-card"><div class="card-head"><div><span class="card-kicker">운행 종료</span><h2>도착 기록 입력</h2></div></div>
    <div class="trip-summary"><div><span>행선지</span><strong>${esc(a.destination||"-")}</strong></div><div><span>출발 키로수</span><strong>${Number(a.start_odometer).toLocaleString()} km</strong></div></div>
    <label class="field"><span>도착 키로수 (km)</span><input id="endKm" class="input" type="number" min="${Number(a.start_odometer)}" step="0.1" inputmode="decimal" placeholder="${Number(a.start_odometer).toLocaleString()} km 이상 입력"></label>
    <p class="field-help">도착 키로수는 출발 키로수보다 작을 수 없습니다.</p>
    <button class="btn primary" onclick="endTrip('${a.id}')">운행 종료하기</button>
  </div>`,state.data.facility.name);
}
window.endTrip=async function(id){const endOdometer=Number(document.getElementById("endKm").value);if(!Number.isFinite(endOdometer))return toast("도착 키로수를 입력해주세요.");try{await api({action:"endTrip",tripId:id,endOdometer});toast("운행을 종료했습니다.");await loadPublic()}catch(e){toast(e.message)}}

const SESSION_KEY="vehiclelogbook_session_v2";

function readSession(){
  try{return JSON.parse(localStorage.getItem(SESSION_KEY)||"null")}catch(_){return null}
}
function writeSession(session){
  if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}
async function refreshSession(session){
  if(!session?.refresh_token)throw new Error("로그인 세션이 만료되었습니다.");
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
    body:JSON.stringify({refresh_token:session.refresh_token})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error_description||data.msg||"로그인 세션이 만료되었습니다.");
  writeSession(data);
  return data;
}
async function validSession(){
  let session=readSession();
  if(!session?.access_token)throw new Error("로그인이 필요합니다.");
  const exp=Number(session.expires_at||0);
  if(exp && exp*1000<Date.now()+30000)session=await refreshSession(session);
  return session;
}
async function authUser(){
  let session=await validSession();
  let r=await fetch(SUPABASE_URL+"/auth/v1/user",{
    headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token}
  });
  if(r.status===401 && session.refresh_token){
    session=await refreshSession(session);
    r=await fetch(SUPABASE_URL+"/auth/v1/user",{
      headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token}
    });
  }
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.msg||data.error_description||"로그인 세션이 유효하지 않습니다.");
  return data;
}
async function signIn(email,password){
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},
    body:JSON.stringify({email,password})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error_description||data.msg||"로그인 정보를 확인해주세요.");
  writeSession(data);
  return data;
}
async function signOut(){
  const session=readSession();
  writeSession(null);
  if(session?.access_token){
    try{
      await fetch(SUPABASE_URL+"/auth/v1/logout",{
        method:"POST",
        headers:{"apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token}
      });
    }catch(_){}
  }
}
async function restRequest(path,options={}){
  const session=await validSession();
  const headers={
    "apikey":SUPABASE_KEY,
    "Authorization":"Bearer "+session.access_token,
    "Accept":"application/json",
    ...(options.body?{"Content-Type":"application/json"}:{}),
    ...(options.headers||{})
  };
  const r=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers});
  const raw=await r.text();
  let data=null;
  if(raw){try{data=JSON.parse(raw)}catch(_){data=raw}}
  if(!r.ok){
    const msg=(data&&typeof data==="object"&&(data.message||data.hint||data.details))||"데이터 처리 중 오류가 발생했습니다.";
    throw new Error(msg);
  }
  return data;
}
const eq=v=>"eq."+encodeURIComponent(v);

async function renderAdmin(){
  try{
    if(!readSession())return renderLogin();
    await loadAdminContext();
    return renderAdminHome();
  }catch(error){
    console.error("admin render failed",error);
    writeSession(null);
    renderLogin();
    setTimeout(()=>toast("세션을 초기화했습니다. 다시 로그인해주세요."),50);
  }
}
function renderLogin(){
  const sharedLogin=(qs.get("login")||"").trim().toUpperCase();
  app.innerHTML=`<main class="login-wrap"><section class="login-card"><div class="brand-mark">VL</div><h1>관리자 로그인</h1><p>시설별 관리자 계정으로 로그인하면 해당 시설의 차량, 직원, 운행목적과 월간 운행일지를 관리할 수 있습니다.</p><label class="field"><span>시설 ID</span><input id="loginId" class="input" autocomplete="username" placeholder="예: SEOUL01" value="${esc(sharedLogin)}"></label><label class="field"><span>비밀번호</span><input id="loginPw" class="input" type="password" autocomplete="current-password"></label><button class="btn primary" onclick="adminLogin()">로그인</button><button class="btn light" onclick="location.href='./'">직원 화면으로</button></section></main>`;
}
window.adminLogin=async function(){
  const id=document.getElementById("loginId").value.trim().toLowerCase();
  const password=document.getElementById("loginPw").value;
  if(!id||!password)return toast("시설 ID와 비밀번호를 입력해주세요.");
  const email=id==="master"?"fomhr@sc.or.kr":(id.includes("@")?id:id+"@vehiclelog.local");
  const button=document.querySelector('[onclick="adminLogin()"]');
  if(button){button.disabled=true;button.textContent="로그인 중...";}
  try{
    await signIn(email,password);
    await loadAdminContext();
    state.adminTab="dashboard";
    renderAdminHome();
  }catch(error){
    writeSession(null);
    toast(error.message||"로그인 정보를 확인해주세요.");
  }finally{
    if(button){button.disabled=false;button.textContent="로그인";}
  }
}
async function loadAdminContext(){
  const user=await authUser();
  const profiles=await restRequest("profiles?select=id,facility_id,display_name,role&id="+eq(user.id));
  const profile=profiles?.[0];
  if(!profile)throw new Error("관리자 권한 정보가 없습니다.");

  const [facilities,vehicles,members,purposes]=await Promise.all([
    restRequest("facilities?select=*&id="+eq(profile.facility_id)),
    restRequest("vehicles?select=*&facility_id="+eq(profile.facility_id)+"&order=sort_order.asc,plate_number.asc"),
    restRequest("facility_members?select=*&facility_id="+eq(profile.facility_id)+"&order=sort_order.asc,name.asc"),
    restRequest("trip_purposes?select=*&facility_id="+eq(profile.facility_id)+"&order=sort_order.asc,name.asc")
  ]);
  const facility=facilities?.[0];
  if(!facility)throw new Error("시설 정보를 찾을 수 없습니다.");
  state.admin={profile,facility,vehicles:vehicles||[],members:members||[],purposes:purposes||[]};
}
function adminFrame(content){
  const a=state.admin;
  app.innerHTML=`<main class="admin-shell"><header class="admin-head"><div><p class="eyebrow">${a.profile.role==="superadmin"?"SYSTEM ADMIN":"FACILITY ADMIN"}</p><h1>${esc(a.facility.name)}</h1><p>${esc(a.profile.display_name)} · ${esc(a.facility.code)}</p></div><div class="admin-head-actions">${a.facility.code!=="HQ"?`<button class="text-btn preview-btn" onclick="previewFacility('${encodeURIComponent(a.facility.code)}')">담당자 화면 미리보기</button>`:""}<button class="text-btn" onclick="adminLogout()">로그아웃</button></div></header><nav class="admin-nav"><button class="${state.adminTab==="dashboard"?"active":""}" onclick="setAdminTab('dashboard')">운행현황</button><button class="${state.adminTab==="vehicles"?"active":""}" onclick="setAdminTab('vehicles')">차량</button><button class="${state.adminTab==="members"?"active":""}" onclick="setAdminTab('members')">직원</button><button class="${state.adminTab==="purposes"?"active":""}" onclick="setAdminTab('purposes')">운행목적</button><button class="${state.adminTab==="report"?"active":""}" onclick="setAdminTab('report')">월간 운행일지</button>${a.profile.role==="superadmin"?`<button class="${state.adminTab==="accounts"?"active":""}" onclick="setAdminTab('accounts')">관리자 계정 등록</button>`:""}</nav><div id="adminContent">${content}</div></main>`;
}
window.setAdminTab=function(tab){state.adminTab=tab;renderAdminHome()}
window.adminLogout=async function(){await signOut();state.admin=null;renderLogin()}
window.previewFacility=function(encodedCode){
  const code=decodeURIComponent(encodedCode);
  const url=location.origin+location.pathname+"?facility="+encodeURIComponent(code);
  window.open(url,"_blank","noopener");
}
async function getOverview(force=false){
  if(state.admin?.profile?.role!=="superadmin")return null;
  if(!force&&state.overview)return state.overview;
  state.overview=await callAdminApi({action:"overview"});
  return state.overview;
}
async function renderAdminHome(){
  if(state.adminTab==="dashboard")return renderDashboard();
  if(state.adminTab==="vehicles")return state.admin.profile.role==="superadmin"?renderGlobalManager("vehicles"):renderManager("vehicles","차량 관리","plate_number","차량번호");
  if(state.adminTab==="members")return state.admin.profile.role==="superadmin"?renderGlobalManager("members"):renderManager("facility_members","직원 관리","name","직원명");
  if(state.adminTab==="purposes")return state.admin.profile.role==="superadmin"?renderGlobalManager("purposes"):renderManager("trip_purposes","운행목적 관리","name","운행목적");
  if(state.adminTab==="report")return renderReport();
  if(state.adminTab==="accounts"&&state.admin.profile.role==="superadmin")return renderAccountRegistration();
  state.adminTab="dashboard";
  return renderDashboard();
}
async function renderDashboard(){
  if(state.admin.profile.role==="superadmin"){
    adminFrame('<div class="empty">전체 시설 현황을 불러오는 중입니다.</div>');
    try{
      const o=await getOverview(true);
      const facilities=o.stats||[];
      const totalVehicles=facilities.reduce((n,x)=>n+Number(x.vehicleCount||0),0);
      const totalMembers=facilities.reduce((n,x)=>n+Number(x.memberCount||0),0);
      const activeVehicles=facilities.reduce((n,x)=>n+Number(x.activeVehicleCount||0),0);
      const activeDrivers=facilities.reduce((n,x)=>n+Number(x.activeDriverCount||0),0);
      const rows=facilities.map(x=>`<tr><td><strong>${esc(x.facility.name)}</strong><small>${esc(x.facility.code)}</small></td><td>${x.vehicleCount}</td><td>${x.memberCount}</td><td>${x.activeVehicleCount}</td><td>${x.activeDriverCount}</td><td><button class="icon-btn" onclick="previewFacility('${encodeURIComponent(x.facility.code)}')">미리보기</button></td></tr>`).join("");
      adminFrame(`<section class="stats super-stats"><div class="stat"><span>등록 시설</span><strong>${facilities.length}</strong></div><div class="stat"><span>운영 차량</span><strong>${totalVehicles}</strong></div><div class="stat"><span>등록 직원</span><strong>${totalMembers}</strong></div><div class="stat"><span>운행 중 차량</span><strong>${activeVehicles}</strong></div><div class="stat"><span>운행 중 직원</span><strong>${activeDrivers}</strong></div></section><section class="card"><h2>시설별 운영 현황</h2><p>관리자 계정에 연결된 시설만 집계합니다. 시스템 관리자(HQ)와 별도 테스트 데이터는 집계에서 제외됩니다.</p><div class="table-scroll"><table class="admin-table"><thead><tr><th>시설</th><th>차량</th><th>직원</th><th>운행 중 차량</th><th>운행 중 직원</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6">등록된 시설이 없습니다.</td></tr>'}</tbody></table></div></section>`);
    }catch(error){adminFrame('<div class="empty">'+esc(error.message||"전체 현황을 불러오지 못했습니다.")+'</div>')}
    return;
  }

  const active=await restRequest("trips?select=id,vehicle_id,driver_id,start_at,destination&facility_id="+eq(state.admin.facility.id)+"&status=eq.active&order=start_at.asc");
  const vm=Object.fromEntries(state.admin.vehicles.map(x=>[x.id,x.plate_number]));
  const mm=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
  adminFrame(`<section class="stats"><div class="stat"><span>등록 차량</span><strong>${state.admin.vehicles.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>등록 직원</span><strong>${state.admin.members.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>현재 운행 중</span><strong>${(active||[]).length}</strong></div></section><section class="card"><h2>현재 운행</h2><p>직원 화면의 운행 상태와 실시간으로 동일하게 반영됩니다.</p><div>${(active||[]).map(x=>`<div class="trip-row"><strong>${esc(vm[x.vehicle_id]||"차량")} · ${esc(mm[x.driver_id]||"운행자")}</strong><small>${fmtTime(x.start_at)} 출발 · ${esc(x.destination||"")}</small></div>`).join("")||'<div class="empty" style="margin-top:14px">현재 운행 중인 차량이 없습니다.</div>'}</div></section>`);
}

const globalManagerConfig={
  vehicles:{title:"전체 시설 차량",table:"vehicles",key:"plate_number",label:"차량번호"},
  members:{title:"전체 시설 직원",table:"facility_members",key:"name",label:"직원명"},
  purposes:{title:"전체 시설 운행목적",table:"trip_purposes",key:"name",label:"운행목적"}
};

async function renderGlobalManager(type){
  const cfg=globalManagerConfig[type];
  if(!cfg)return;
  adminFrame('<div class="empty">'+cfg.title+' 정보를 불러오는 중입니다.</div>');
  try{
    const o=await getOverview(true);
    const facilityMap=Object.fromEntries((o.facilities||[]).map(f=>[f.id,f]));
    let rows=[];
    if(type==="vehicles")rows=o.vehicles||[];
    else if(type==="members")rows=o.members||[];
    else rows=await restRequest("trip_purposes?select=*&order=name.asc");

    const facilityOptions=(o.facilities||[]).map(f=>`<option value="${f.id}">${esc(f.name)} (${esc(f.code)})</option>`).join("");
    const body=rows.map(r=>{
      const f=facilityMap[r.facility_id]||{};
      const value=r[cfg.key]||"";
      const sub=type==="vehicles"?(r.label||""):"";
      return `<tr><td><strong>${esc(f.name||"미지정")}</strong><small>${esc(f.code||"")}</small></td><td><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:""}</td><td>${r.is_active?"사용 중":"사용 안 함"}</td><td><div class="row-actions"><button class="icon-btn" onclick="editItem('${cfg.table}','${r.id}','${cfg.key}','${encodeURIComponent(value)}')">수정</button><button class="icon-btn danger" onclick="removeItem('${cfg.table}','${r.id}')">삭제</button></div></td></tr>`;
    }).join("");

    adminFrame(`<section class="card"><h2>${cfg.title}</h2><p>최고관리자는 관리자 계정에 등록된 모든 시설의 데이터를 조회·입력·수정·삭제할 수 있습니다.</p><div class="global-add-form"><select id="globalFacility" class="select"><option value="">시설 선택</option>${facilityOptions}</select><input id="globalValue" class="input" placeholder="${cfg.label} 입력"><button class="btn primary" onclick="addGlobalItem('${type}')">추가</button></div><div class="table-scroll"><table class="admin-table"><thead><tr><th>시설명</th><th>${cfg.label}</th><th>상태</th><th>관리</th></tr></thead><tbody>${body||'<tr><td colspan="4">등록된 데이터가 없습니다.</td></tr>'}</tbody></table></div></section>`);
  }catch(error){adminFrame('<div class="empty">'+esc(error.message||"목록을 불러오지 못했습니다.")+'</div>')}
}

function managerData(table){
  if(table==="vehicles")return state.admin.vehicles;
  if(table==="facility_members")return state.admin.members;
  return state.admin.purposes;
}
function renderManager(table,title,key,label){
  const rows=managerData(table);
  adminFrame(`<section class="card"><h2>${title}</h2><p>${esc(state.admin.facility.name)}에 등록된 항목만 표시됩니다. 입력·수정·삭제한 내용은 해당 시설의 직원용 화면에 바로 반영됩니다.</p><div style="margin-top:12px">${rows.map(r=>`<div class="manager-row"><div><strong>${esc(r[key])}</strong><br><small>${r.is_active?"사용 중":"사용 안 함"}</small></div><div class="row-actions"><button class="icon-btn" onclick="editItem('${table}','${r.id}','${key}','${encodeURIComponent(r[key]||"")}')">수정</button><button class="icon-btn danger" onclick="removeItem('${table}','${r.id}')">삭제</button></div></div>`).join("")||'<div class="empty">등록된 항목이 없습니다.</div>'}</div><div class="inline-form"><input id="newItem" class="input" placeholder="${label} 입력"><button class="btn primary" onclick="addItem('${table}','${key}')">추가</button></div></section>`);
}

window.addItem=async function(table,key){
  const value=document.getElementById("newItem").value.trim();
  if(!value)return toast("입력값을 확인해주세요.");
  const payload={facility_id:state.admin.facility.id,[key]:value,sort_order:managerData(table).length+1};
  try{
    await restRequest(table,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
    await loadAdminContext();
    renderAdminHome();
    toast("추가했습니다.");
  }catch(error){toast(error.message||"추가하지 못했습니다.")}
}

window.addGlobalItem=async function(type){
  const cfg=globalManagerConfig[type];
  const facilityId=document.getElementById("globalFacility")?.value;
  const value=document.getElementById("globalValue")?.value.trim();
  if(!cfg||!facilityId||!value)return toast("시설과 입력값을 확인해주세요.");
  try{
    await restRequest(cfg.table,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({facility_id:facilityId,[cfg.key]:value,sort_order:999})});
    state.overview=null;
    await renderGlobalManager(type);
    toast("추가했습니다.");
  }catch(error){toast(error.message||"추가하지 못했습니다.")}
}

window.editItem=async function(table,id,key,encodedValue){
  const current=decodeURIComponent(encodedValue||"");
  const next=prompt("수정할 값을 입력해주세요.",current);
  if(next===null)return;
  const value=next.trim();
  if(!value)return toast("빈 값으로 수정할 수 없습니다.");
  try{
    await restRequest(table+"?id="+eq(id),{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify({[key]:value})});
    if(state.admin.profile.role==="superadmin"){
      state.overview=null;
      await renderAdminHome();
    }else{
      await loadAdminContext();
      await renderAdminHome();
    }
    toast("수정했습니다.");
  }catch(error){toast(error.message||"수정하지 못했습니다.")}
}

window.removeItem=async function(table,id){
  if(!confirm("삭제할까요?"))return;
  try{
    await restRequest(table+"?id="+eq(id),{method:"DELETE"});
    if(state.admin.profile.role==="superadmin"){
      state.overview=null;
      await renderAdminHome();
    }else{
      await loadAdminContext();
      await renderAdminHome();
    }
    toast("삭제했습니다.");
  }catch(error){toast("운행기록에서 사용 중인 항목은 삭제할 수 없습니다.")}
}

function renderAccountRegistration(){
  adminFrame(`<section class="card"><h2>관리자 계정 등록</h2><p>시설명과 로그인 정보를 입력하면 해당 시설 전용 관리자 계정과 직원용 접속 주소를 생성합니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>시설명</span><input id="accountFacilityName" class="input" placeholder="예: 서울○○아동보호전문기관"></label><label class="field" style="margin:0"><span>시설 코드</span><input id="accountFacilityCode" class="input" placeholder="예: SEOUL01"></label><label class="field" style="margin:0"><span>관리자 ID</span><input id="accountLoginId" class="input" placeholder="예: SEOUL01"></label></div><label class="field"><span>초기 비밀번호</span><input id="accountPassword" class="input" type="password" placeholder="초기 비밀번호 입력"></label><button class="btn primary" onclick="prepareFacilityAccount()">관리자 계정 등록</button><div id="accountGuide" class="empty" style="display:none;margin-top:14px"></div></section><section class="card"><div class="admin-list-head"><div><h2>관리자 계정 목록</h2><p>계정을 클릭하면 공유 가능한 관리자 로그인 링크와 직원용 시설 링크를 확인할 수 있습니다.</p></div><button class="text-btn" onclick="loadAdminAccounts()">새로고침</button></div><div id="adminAccountList"><div class="empty">관리자 목록을 불러오는 중입니다.</div></div></section>`);
  loadAdminAccounts();
}

async function callAdminApi(payload){
  const session=await validSession();
  const response=await fetch(SUPABASE_URL+"/functions/v1/vehicle-log-admin",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":"Bearer "+session.access_token,
      "apikey":SUPABASE_KEY
    },
    body:JSON.stringify(payload)
  });
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(result.error||"관리자 정보를 처리하지 못했습니다.");
  return result;
}

window.loadAdminAccounts=async function(){
  const wrap=document.getElementById("adminAccountList");
  if(!wrap)return;
  wrap.innerHTML='<div class="empty">관리자 목록을 불러오는 중입니다.</div>';
  try{
    const result=await callAdminApi({action:"list"});
    const admins=result.admins||[];
    if(!admins.length){
      wrap.innerHTML='<div class="empty">등록된 시설 관리자 계정이 없습니다.</div>';
      return;
    }
    wrap.innerHTML=admins.map((item,i)=>{
      const code=item.facility?.code||"";
      const name=item.facility?.name||"시설";
      const loginId=item.loginId||"";
      const adminUrl=location.origin+location.pathname+"?admin=1&login="+encodeURIComponent(loginId);
      const staffUrl=location.origin+location.pathname+"?facility="+encodeURIComponent(code);
      return `<div class="admin-account-row"><button type="button" class="admin-account-summary" onclick="toggleAdminShare('adminShare${i}')"><span><strong>${esc(name)}</strong><small>${esc(code)} · 관리자 ID ${esc(loginId)}</small></span><span class="share-open">공유 링크 ›</span></button><div id="adminShare${i}" class="admin-share-panel" hidden><button class="btn light preview-account-btn" onclick="previewFacility('${encodeURIComponent(code)}')">담당자 화면 미리보기</button><label>관리자 로그인 링크</label><div class="share-line"><input class="input" readonly value="${esc(adminUrl)}"><button class="icon-btn" onclick="copyShareLink('${encodeURIComponent(adminUrl)}')">복사</button></div><label>직원용 시설 링크</label><div class="share-line"><input class="input" readonly value="${esc(staffUrl)}"><button class="icon-btn" onclick="copyShareLink('${encodeURIComponent(staffUrl)}')">복사</button></div></div></div>`;
    }).join("");
  }catch(error){
    wrap.innerHTML='<div class="empty">'+esc(error.message||"관리자 목록을 불러오지 못했습니다.")+'</div>';
  }
}

window.toggleAdminShare=function(id){
  const panel=document.getElementById(id);
  if(panel)panel.hidden=!panel.hidden;
}

window.copyShareLink=async function(encoded){
  const url=decodeURIComponent(encoded);
  try{
    await navigator.clipboard.writeText(url);
    toast("공유 링크를 복사했습니다.");
  }catch(_){
    prompt("아래 링크를 복사해주세요.",url);
  }
}

window.prepareFacilityAccount=async function(){
  const name=document.getElementById("accountFacilityName").value.trim();
  const code=document.getElementById("accountFacilityCode").value.trim().toUpperCase();
  const login=document.getElementById("accountLoginId").value.trim().toUpperCase();
  const pw=document.getElementById("accountPassword").value;
  if(!name||!code||!login||!pw)return toast("시설명, 시설 코드, 관리자 ID, 초기 비밀번호를 입력해주세요.");

  const button=document.querySelector('[onclick="prepareFacilityAccount()"]');
  if(button){button.disabled=true;button.textContent="계정 생성 중...";}
  try{
    await callAdminApi({
      action:"create",
      facilityName:name,
      facilityCode:code,
      loginId:login,
      password:pw
    });

    const staffUrl=location.origin+location.pathname+"?facility="+encodeURIComponent(code);
    const adminUrl=location.origin+location.pathname+"?admin=1&login="+encodeURIComponent(login);
    const box=document.getElementById("accountGuide");
    box.style.display="block";
    box.innerHTML="<strong>"+esc(name)+"</strong><br>관리자 ID: "+esc(login)+"<br><br>관리자 공유 링크:<br><span style='word-break:break-all'>"+esc(adminUrl)+"</span><br><br>직원용 주소:<br><span style='word-break:break-all'>"+esc(staffUrl)+"</span>";
    document.getElementById("accountFacilityName").value="";
    document.getElementById("accountFacilityCode").value="";
    document.getElementById("accountLoginId").value="";
    document.getElementById("accountPassword").value="";
    await loadAdminAccounts();
    toast("시설 관리자 계정을 생성했습니다.");
  }catch(error){toast(error.message||"계정 생성에 실패했습니다.");}
  finally{if(button){button.disabled=false;button.textContent="관리자 계정 등록";}}
}

async function renderReport(){
  const now=new Date().toISOString().slice(0,7);
  let vehicles=state.admin.vehicles, facilityMap={};
  if(state.admin.profile.role==="superadmin"){
    adminFrame('<div class="empty">시설별 차량 정보를 불러오는 중입니다.</div>');
    try{
      const o=await getOverview(true);
      vehicles=o.vehicles||[];
      facilityMap=Object.fromEntries((o.facilities||[]).map(f=>[f.id,f]));
    }catch(error){adminFrame('<div class="empty">'+esc(error.message||"차량 정보를 불러오지 못했습니다.")+'</div>');return}
  }
  const options=vehicles.map(v=>{
    const prefix=state.admin.profile.role==="superadmin"?(facilityMap[v.facility_id]?.name||"시설")+" · ":"";
    return `<option value="${v.id}">${esc(prefix+v.plate_number)}</option>`;
  }).join("");
  adminFrame(`<section class="card"><h2>월간 차량운행일지</h2><p>차량과 대상월을 선택하면 화면 예시와 같은 월간 단일 시트 Excel로 내려받습니다. 셀은 모두 수정 가능합니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>대상월</span><input id="reportMonth" class="input" type="month" value="${now}"></label><label class="field" style="margin:0"><span>차량</span><select id="reportVehicle" class="select"><option value="">차량 선택</option>${options}</select></label><button class="btn dark" onclick="downloadReport()">Excel 다운로드</button></div><p class="report-note">열 구성: 날짜 · 운전자 · 동행자 · 용무 · 행선지 · 출발시간 · 도착시간 · 출발km · 도착km · 운행거리</p></section>`);
}

const xlsxXml=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const xlsxText=(ref,value,style=3)=>`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xlsxXml(value)}</t></is></c>`;
const xlsxNum=(ref,value,style=3)=>value===""||value==null?xlsxText(ref,"",style):`<c r="${ref}" s="${style}" t="n"><v>${Number(value)}</v></c>`;
const seoulDateKey=v=>{
  const p=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return o.year+"-"+o.month+"-"+o.day;
};
const seoulTime=v=>v?new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(v)):"";
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc32=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0};
const u16=(v)=>new Uint8Array([v&255,(v>>>8)&255]);
const u32=(v)=>new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);
const concatBytes=parts=>{const len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};
function zipStore(files){
  const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;
  for(const file of files){
    const name=enc.encode(file.name),data=typeof file.data==="string"?enc.encode(file.data):file.data,crc=crc32(data),flags=0x0800;
    const local=concatBytes([u32(0x04034b50),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);
    locals.push(local);
    const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(flags),u16(0),u16(0),u16(0),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);
    centrals.push(central);offset+=local.length;
  }
  const centralBytes=concatBytes(centrals);
  const end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralBytes.length),u32(offset),u16(0)]);
  return concatBytes([...locals,centralBytes,end]);
}
function buildMonthlyXlsx(month,rows,vehicle,members,purposes,facilityName=""){
  const sheetRows=[];
  const add=(n,cells,h)=>sheetRows.push(`<row r="${n}"${h?` ht="${h}" customHeight="1"`:""}>${cells.join("")}</row>`);
  add(1,[xlsxText("H1","결재",7),xlsxText("I1","담당",2),xlsxText("J1","팀장",2)],28);
  add(2,[xlsxText("H2","",7),xlsxText("I2","",3),xlsxText("J2","",3)],34);
  add(3,[],8);
  add(4,[xlsxText("A4","차량운행일지",1)],30);
  add(5,[],8);
  add(6,[xlsxText("A6","차량",2),xlsxText("B6",vehicle?.plate_number||"",6),xlsxText("C6","",3),xlsxText("D6","시설",2),xlsxText("E6",facilityName,6),xlsxText("F6","",3),xlsxText("G6","",3)],23);
  add(7,[xlsxText("A7","대상월",2),xlsxText("B7",month,6)],23);
  add(8,["날짜","운전자","동행자","용무","행선지","출발시간","도착시간","출발km","도착km","운행거리"].map((x,i)=>xlsxText(String.fromCharCode(65+i)+"8",x,2)),25);
  const bodyCount=Math.max(30,rows.length);
  for(let i=0;i<bodyCount;i++){
    const n=9+i,r=rows[i];
    add(n,[
      xlsxText(`A${n}`,r?seoulDateKey(r.start_at):"",3),
      xlsxText(`B${n}`,r?members[r.driver_id]||"":"",3),
      xlsxText(`C${n}`,r?(r.passenger_ids||[]).map(id=>members[id]).filter(Boolean).join(", "):"",3),
      xlsxText(`D${n}`,r?purposes[r.purpose_id]||"":"",4),
      xlsxText(`E${n}`,r?r.destination||"":"",4),
      xlsxText(`F${n}`,r?seoulTime(r.start_at):"",3),
      xlsxText(`G${n}`,r?seoulTime(r.end_at):"",3),
      r?xlsxNum(`H${n}`,r.start_odometer,3):xlsxText(`H${n}`,"",3),
      r?xlsxNum(`I${n}`,r.end_odometer,3):xlsxText(`I${n}`,"",3),
      r?xlsxNum(`J${n}`,r.distance,3):xlsxText(`J${n}`,"",3)
    ],22);
  }
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="3" width="14" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="20" customWidth="1"/><col min="6" max="7" width="12" customWidth="1"/><col min="8" max="10" width="13" customWidth="1"/></cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A8:J${8+bodyCount}"/><mergeCells count="4"><mergeCell ref="A4:J4"/><mergeCell ref="H1:H2"/><mergeCell ref="B6:C6"/><mergeCell ref="E6:G6"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Malgun Gothic"/></font><font><b/><sz val="18"/><name val="Malgun Gothic"/></font><font><b/><sz val="10"/><name val="Malgun Gothic"/></font><font><sz val="10"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipStore([
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="차량운행일지" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:styles},
    {name:"xl/worksheets/sheet1.xml",data:sheet}
  ]);
}
window.downloadReport=async function(){
  const month=document.getElementById("reportMonth").value;
  const vehicleId=document.getElementById("reportVehicle").value;
  if(!month||!vehicleId)return toast("대상월과 차량을 선택해주세요.");

  try{
    let rows=[],members={},purposes={},vehicle=null,facilityName="";
    if(state.admin.profile.role==="superadmin"){
      const result=await callAdminApi({action:"report",vehicleId,month});
      rows=result.trips||[];
      members=Object.fromEntries((result.members||[]).map(x=>[x.id,x.name]));
      purposes=Object.fromEntries((result.purposes||[]).map(x=>[x.id,x.name]));
      vehicle=result.vehicle;
      facilityName=result.facility?.name||"";
    }else{
      const start=month+"-01T00:00:00+09:00";
      const endDate=new Date(month+"-01T00:00:00+09:00");endDate.setMonth(endDate.getMonth()+1);
      rows=await restRequest("trips?select=*&facility_id="+eq(state.admin.facility.id)+"&vehicle_id="+eq(vehicleId)+"&status=eq.ended&start_at=gte."+encodeURIComponent(start)+"&start_at=lt."+encodeURIComponent(endDate.toISOString())+"&order=start_at.asc");
      members=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
      purposes=Object.fromEntries(state.admin.purposes.map(x=>[x.id,x.name]));
      vehicle=state.admin.vehicles.find(x=>x.id===vehicleId);
      facilityName=state.admin.facility.name;
    }

    const bytes=buildMonthlyXlsx(month,rows||[],vehicle,members,purposes,facilityName);
    const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`차량운행일지_${vehicle?.plate_number||"차량"}_${month}.xlsx`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    toast("수정 가능한 월간 Excel 운행일지를 다운로드했습니다.");
  }catch(error){toast(error.message||"운행일지를 만들지 못했습니다.")}
};
(async()=>{
  try{
    if(qs.get("admin")==="1") await renderAdmin();
    else await loadPublic();
  }catch(error){
    console.error("app start failed",error);
    app.innerHTML='<main class="login-wrap"><section class="login-card"><div class="brand-mark">VL</div><h1>VehicleLogBook</h1><p>화면을 불러오는 중 오류가 발생했습니다.</p><button class="btn light" onclick="location.reload()">새로고침</button></section></main>';
  }
})();