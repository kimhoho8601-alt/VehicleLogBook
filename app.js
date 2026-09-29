const SUPABASE_URL="https://ibxckzjregbbtqwjitwj.supabase.co";
const SUPABASE_KEY="sb_publishable_frUifOywlvlSly4Vcmsf8g_zbLzylQd";
const PUBLIC_API=SUPABASE_URL+"/functions/v1/vehicle-log-public";

const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const state={facilityCode:(qs.get("facility")||"").trim().toUpperCase(),data:null,selectedVehicle:null,passengers:new Set(),admin:null,adminTab:"dashboard"};

const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
async function api(payload){const r=await fetch(PUBLIC_API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({...payload,facilityCode:state.facilityCode})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"서버 연결에 실패했습니다.");return d}
const fmtTime=v=>v?new Date(v).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}):"";
const fmtDate=v=>v?new Date(v).toLocaleDateString("ko-KR"):"";

function userShell(body,title="차량 운행기록"){app.innerHTML=`<main class="shell"><header class="topbar"><div class="brand"><div class="brand-mark">VL</div><div class="brand-copy"><strong>VehicleLogBook</strong><span>${esc(title)}</span></div></div><button class="admin-link" onclick="location.href='?admin=1'">관리자</button></header>${body}</main>`}
async function loadPublic(){if(!state.facilityCode){userShell(`<section class="hero"><p class="eyebrow">VEHICLE LOGBOOK</p><h1>시설 QR로<br>접속해주세요.</h1><p>이 페이지는 시설별 QR 주소를 통해 사용합니다.</p></section><div class="empty">시설 코드가 없는 주소입니다.<br>관리자가 배포한 QR 또는 링크로 접속해주세요.</div>`);return}
try{const d=await api({action:"bootstrap"});state.data=d;renderVehicles()}catch(e){userShell(`<div class="empty">${esc(e.message)}</div>`,"연결 오류")}}

function renderVehicles(){const d=state.data;const cards=d.vehicles.map(v=>{const a=d.active?.[v.id];return `<button class="vehicle-card" onclick="selectVehicle('${v.id}')"><div><div class="plate">${esc(v.plate_number)}</div><div class="label">${esc(v.label||d.facility.name)}</div>${a?`<div class="live-meta">${esc(a.driver_name)} · ${fmtTime(a.start_at)} 출발</div>`:""}</div><span class="status-chip ${a?"live":"ok"}">${a?"운행 중":"운행 가능"}</span></button>`}).join("");
userShell(`<section class="hero"><p class="eyebrow">${esc(d.facility.code)}</p><h1>${esc(d.facility.name)}</h1><p>차량을 선택해 운행을 시작하거나 종료하세요.</p></section><section class="grid">${cards||'<div class="empty">등록된 차량이 없습니다.</div>'}</section>`,d.facility.name)}

window.selectVehicle=function(id){state.selectedVehicle=id;state.passengers.clear();const v=state.data.vehicles.find(x=>x.id===id);const a=state.data.active?.[id];if(a)return renderEnd(v,a);renderStart(v)}
function renderStart(v){const members=state.data.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join("");const purposes=state.data.purposes.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");const chips=state.data.members.map(m=>`<button type="button" class="choice" data-passenger="${m.id}" onclick="togglePassenger(this)">${esc(m.name)}</button>`).join("");
userShell(`<button class="back" onclick="renderVehicles()">← 차량 다시 선택</button><div class="card"><p class="eyebrow">운행 시작</p><h2>${esc(v.plate_number)}</h2><p>출발 전 키로수를 확인한 뒤 운행을 시작하세요.</p><label class="field"><span>운행자</span><select id="driver" class="select"><option value="">선택</option>${members}</select></label><div class="field"><span>동승자</span><div class="multi">${chips}</div></div><label class="field"><span>운행목적</span><select id="purpose" class="select"><option value="">선택</option>${purposes}</select></label><label class="field"><span>행선지</span><input id="destination" class="input" placeholder="예: ○○구청"></label><label class="field"><span>출발 키로수 (km)</span><input id="startKm" class="input" type="number" min="0" step="0.1" inputmode="decimal" placeholder="예: 42351"></label><button class="btn primary" onclick="startTrip()">운행 시작</button></div>`,state.data.facility.name)}
window.togglePassenger=function(btn){const id=btn.dataset.passenger;state.passengers.has(id)?state.passengers.delete(id):state.passengers.add(id);btn.classList.toggle("active",state.passengers.has(id))}
window.startTrip=async function(){const driverId=document.getElementById("driver").value,purposeId=document.getElementById("purpose").value,destination=document.getElementById("destination").value.trim(),startOdometer=Number(document.getElementById("startKm").value);if(!driverId||!purposeId||!destination||!Number.isFinite(startOdometer))return toast("필수 항목을 모두 입력해주세요.");try{await api({action:"startTrip",vehicleId:state.selectedVehicle,driverId,passengerIds:[...state.passengers],purposeId,destination,startOdometer});toast("운행을 시작했습니다.");await loadPublic()}catch(e){toast(e.message)}}
function renderEnd(v,a){userShell(`<button class="back" onclick="renderVehicles()">← 차량 다시 선택</button><div class="card"><p class="eyebrow">운행 중</p><h2>${esc(v.plate_number)}</h2><p><strong>${esc(a.driver_name)}</strong> 님이 ${fmtTime(a.start_at)}부터 운행 중입니다.</p><div class="field"><span>행선지</span><div class="input" style="background:#faf7f8">${esc(a.destination||"-")}</div></div><label class="field"><span>도착 키로수 (km)</span><input id="endKm" class="input" type="number" min="${Number(a.start_odometer)}" step="0.1" inputmode="decimal" placeholder="출발 ${a.start_odometer} km 이상"></label><button class="btn dark" onclick="endTrip('${a.id}')">운행 종료</button></div>`,state.data.facility.name)}
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
async function renderAdminHome(){
  if(state.adminTab==="dashboard")return renderDashboard();
  if(state.adminTab==="vehicles")return renderManager("vehicles","차량 관리","plate_number","차량번호");
  if(state.adminTab==="members")return renderManager("facility_members","직원 관리","name","직원명");
  if(state.adminTab==="purposes")return renderManager("trip_purposes","운행목적 관리","name","운행목적");
  if(state.adminTab==="report")return renderReport();
  if(state.adminTab==="accounts"&&state.admin.profile.role==="superadmin")return renderAccountRegistration();
  state.adminTab="dashboard";
  return renderDashboard();
}
async function renderDashboard(){
  const active=await restRequest("trips?select=id,vehicle_id,driver_id,start_at,destination&facility_id="+eq(state.admin.facility.id)+"&status=eq.active&order=start_at.asc");
  const vm=Object.fromEntries(state.admin.vehicles.map(x=>[x.id,x.plate_number]));
  const mm=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
  adminFrame(`<section class="stats"><div class="stat"><span>등록 차량</span><strong>${state.admin.vehicles.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>등록 직원</span><strong>${state.admin.members.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>현재 운행 중</span><strong>${(active||[]).length}</strong></div></section><section class="card"><h2>현재 운행</h2><p>직원 화면의 운행 상태와 실시간으로 동일하게 반영됩니다.</p><div>${(active||[]).map(x=>`<div class="trip-row"><strong>${esc(vm[x.vehicle_id]||"차량")} · ${esc(mm[x.driver_id]||"운행자")}</strong><small>${fmtTime(x.start_at)} 출발 · ${esc(x.destination||"")}</small></div>`).join("")||'<div class="empty" style="margin-top:14px">현재 운행 중인 차량이 없습니다.</div>'}</div></section>`);
}
function managerData(table){
  if(table==="vehicles")return state.admin.vehicles;
  if(table==="facility_members")return state.admin.members;
  return state.admin.purposes;
}
function renderManager(table,title,key,label){
  const rows=managerData(table);
  adminFrame(`<section class="card"><h2>${title}</h2><p>저장하면 직원용 화면에 바로 반영됩니다.</p><div style="margin-top:12px">${rows.map(r=>`<div class="manager-row"><div><strong>${esc(r[key])}</strong><br><small>${r.is_active?"사용 중":"사용 안 함"}</small></div><button class="icon-btn" onclick="removeItem('${table}','${r.id}')">삭제</button></div>`).join("")||'<div class="empty">등록된 항목이 없습니다.</div>'}</div><div class="inline-form"><input id="newItem" class="input" placeholder="${label} 입력"><button class="btn primary" onclick="addItem('${table}','${key}')">추가</button></div></section>`);
}
window.addItem=async function(table,key){
  const value=document.getElementById("newItem").value.trim();
  if(!value)return;
  const payload={facility_id:state.admin.facility.id,[key]:value,sort_order:managerData(table).length+1};
  try{
    await restRequest(table,{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
    await loadAdminContext();
    renderAdminHome();
    toast("추가했습니다.");
  }catch(error){toast(error.message)}
}
window.removeItem=async function(table,id){
  if(!confirm("삭제할까요?"))return;
  try{
    await restRequest(table+"?id="+eq(id),{method:"DELETE"});
    await loadAdminContext();
    renderAdminHome();
    toast("삭제했습니다.");
  }catch(error){toast("운행기록에서 사용 중인 항목은 삭제할 수 없습니다.");}
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
  adminFrame(`<section class="card"><h2>월간 차량운행일지</h2><p>첨부된 차량운행일지 양식을 기준으로, 선택한 한 달을 하나의 Excel 파일로 내려받습니다. 날짜별 시트는 수정 가능한 상태로 생성됩니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>조회 월</span><input id="reportMonth" class="input" type="month" value="${now}"></label><label class="field" style="margin:0"><span>차량</span><select id="reportVehicle" class="select"><option value="">차량 선택</option>${state.admin.vehicles.map(v=>`<option value="${v.id}">${esc(v.plate_number)}</option>`).join("")}</select></label><button class="btn dark" onclick="downloadReport()">Excel 다운로드</button></div><p class="report-note">한 파일 안에 1일~말일까지 날짜별 시트가 생성되며, 결재·유류수불현황·운행현황·운행내용 구조를 원 양식에 맞춰 구성합니다.</p></section>`);
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
function buildDailySheet(day,rows,vehicle,members,purposes){
  const yyyy=day.getFullYear(),mm=String(day.getMonth()+1).padStart(2,"0"),dd=String(day.getDate()).padStart(2,"0");
  const weekday=new Intl.DateTimeFormat("ko-KR",{timeZone:"Asia/Seoul",weekday:"long"}).format(day);
  const first=rows[0],last=rows[rows.length-1];
  const total=rows.reduce((sum,r)=>sum+Number(r.distance||0),0);
  const bodyCount=Math.max(15,rows.length);
  const sheetRows=[],merges=[
    "A1:H2","I1:I2","J1:K1","J2:K2","A3:L3",
    "A5:B5","C5:F5","G5:G8","H5:I5","J5:K5",
    "A6:B8","C6:D6","E6:F6","H6:I6","J6:K6",
    "C7:D7","E7:F7","H7:I7","J7:K7",
    "C8:D8","E8:F8","H8:I8","J8:K8",
    "A9:B9","C9:D9","E9:F10","G9:H10","I9:J9","K9:K10","L9:L10",
    "A10:B10","C10:D10"
  ];
  const addRow=(n,cells,h)=>sheetRows.push(`<row r="${n}"${h?` ht="${h}" customHeight="1"`:""}>${cells.join("")}</row>`);
  addRow(1,[xlsxText("A1","차 량 운 행 일 지",1),xlsxText("I1","결재",8),xlsxText("J1","담 당",8),xlsxText("L1","팀장",8)],28);
  addRow(2,[xlsxText("J2","",3),xlsxText("L2","",3)],28);
  addRow(3,[xlsxText("A3",`${yyyy}년 ${Number(mm)}월 ${Number(dd)}일  ( ${weekday} )`,5)],24);
  addRow(4,[],8);
  addRow(5,[xlsxText("A5","차 량 번 호",6),xlsxText("C5",vehicle?.plate_number||"",7),xlsxText("G5","유\n류\n수\n불\n현\n황",9),xlsxText("H5","금일급유량",6),xlsxText("J5","",7),xlsxText("L5","리터.",3)],24);
  addRow(6,[xlsxText("A6","운\n행\n현\n황",9),xlsxText("C6","전 일 지 침",6),xlsxNum("E6",first?.start_odometer??"",7),xlsxText("H6","급유액",6),xlsxText("J6","",7),xlsxText("L6","원.",3)],24);
  addRow(7,[xlsxText("C7","금일운행거리",6),xlsxNum("E7",rows.length?total:"",7),xlsxText("H7","사용전표",6),xlsxText("J7","",7),xlsxText("L7","No.",3)],24);
  addRow(8,[xlsxText("C8","금 일 지 침",6),xlsxNum("E8",last?.end_odometer??"",7),xlsxText("H8","누계전표",6),xlsxText("J8","",7),xlsxText("L8","총          개.",3)],24);
  addRow(9,[xlsxText("A9","구 분",2),xlsxText("C9","승 차 자",2),xlsxText("E9","용 무",2),xlsxText("G9","행선지",2),xlsxText("I9","운행시간",2),xlsxText("K9","운행\n거리 (km)",2),xlsxText("L9","비고",2)],25);
  addRow(10,[xlsxText("A10","운전자",2),xlsxText("C10","승차자",2),xlsxText("I10","출발",2),xlsxText("J10","도착",2)],23);
  for(let i=0;i<bodyCount;i++){
    const n=11+i,r=rows[i];
    merges.push(`A${n}:B${n}`,`C${n}:D${n}`,`E${n}:F${n}`,`G${n}:H${n}`);
    addRow(n,[
      xlsxText(`A${n}`,r?members[r.driver_id]||"":"",4),
      xlsxText(`C${n}`,r?(r.passenger_ids||[]).map(id=>members[id]).filter(Boolean).join(", "):"",4),
      xlsxText(`E${n}`,r?purposes[r.purpose_id]||"":"",4),
      xlsxText(`G${n}`,r?r.destination||"":"",4),
      xlsxText(`I${n}`,r?seoulTime(r.start_at):"",3),
      xlsxText(`J${n}`,r?seoulTime(r.end_at):"",3),
      r?xlsxNum(`K${n}`,Number(r.distance||0),3):xlsxText(`K${n}`,"",3),
      xlsxText(`L${n}`,r?r.note||"":"",4)
    ],24);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols><col min="1" max="2" width="10" customWidth="1"/><col min="3" max="4" width="11" customWidth="1"/><col min="5" max="6" width="13" customWidth="1"/><col min="7" max="8" width="14" customWidth="1"/><col min="9" max="10" width="9" customWidth="1"/><col min="11" max="11" width="12" customWidth="1"/><col min="12" max="12" width="14" customWidth="1"/></cols><sheetData>${sheetRows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map(x=>`<mergeCell ref="${x}"/>`).join("")}</mergeCells><pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>`;
}
function buildMonthlyXlsx(month,rows,vehicle,members,purposes){
  const [y,m]=month.split("-").map(Number);
  const days=new Date(y,m,0).getDate();
  const files=[],rels=[],sheets=[];
  for(let d=1;d<=days;d++){
    const date=new Date(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T12:00:00+09:00`);
    const key=`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayRows=rows.filter(r=>seoulDateKey(r.start_at)===key);
    files.push({name:`xl/worksheets/sheet${d}.xml`,data:buildDailySheet(date,dayRows,vehicle,members,purposes)});
    rels.push(`<Relationship Id="rId${d}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${d}.xml"/>`);
    sheets.push(`<sheet name="${String(d).padStart(2,"0")}일" sheetId="${d}" r:id="rId${d}"/>`);
  }
  const styleId=days+1;
  rels.push(`<Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`);
  files.push({name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${Array.from({length:days},(_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`});
  files.push({name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
  files.push({name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.join("")}</sheets><calcPr calcId="191029"/></workbook>`});
  files.push({name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`});
  files.push({name:"xl/styles.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Malgun Gothic"/></font><font><b/><sz val="18"/><name val="Malgun Gothic"/></font><font><b/><sz val="10"/><name val="Malgun Gothic"/></font><font><sz val="10"/><name val="Malgun Gothic"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="10"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`});
  return zipStore(files);
}
window.downloadReport=async function(){
  const month=document.getElementById("reportMonth").value;
  const vehicleId=document.getElementById("reportVehicle").value;
  if(!month||!vehicleId)return toast("조회 월과 차량을 선택해주세요.");

  const start=month+"-01T00:00:00+09:00";
  const endDate=new Date(month+"-01T00:00:00+09:00");
  endDate.setMonth(endDate.getMonth()+1);
  let rows;
  try{
    rows=await restRequest("trips?select=*&facility_id="+eq(state.admin.facility.id)+"&vehicle_id="+eq(vehicleId)+"&status=eq.ended&start_at=gte."+encodeURIComponent(start)+"&start_at=lt."+encodeURIComponent(endDate.toISOString())+"&order=start_at.asc");
  }catch(error){return toast(error.message)}

  const members=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
  const purposes=Object.fromEntries(state.admin.purposes.map(x=>[x.id,x.name]));
  const vehicle=state.admin.vehicles.find(x=>x.id===vehicleId);
  const bytes=buildMonthlyXlsx(month,rows||[],vehicle,members,purposes);
  const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`차량운행일지_${vehicle?.plate_number||"차량"}_${month}.xlsx`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  toast("수정 가능한 월간 Excel 운행일지를 다운로드했습니다.");
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