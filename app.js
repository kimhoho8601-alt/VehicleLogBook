const SUPABASE_URL="https://ibxckzjregbbtqwjitwj.supabase.co";
const SUPABASE_KEY="sb_publishable_frUifOywlvlSly4Vcmsf8g_zbLzylQd";
const PUBLIC_API=SUPABASE_URL+"/functions/v1/vehicle-log-public";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const state={facilityCode:(qs.get("facility")||"").trim().toUpperCase(),data:null,selectedVehicle:null,passengers:new Set(),admin:null,adminTab:"dashboard"};

const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
async function api(payload){const r=await fetch(PUBLIC_API,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,facilityCode:state.facilityCode})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"서버 연결에 실패했습니다.");return d}
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

async function renderAdmin(){const {data:{session}}=await db.auth.getSession();if(!session)return renderLogin();await loadAdminContext();renderAdminHome()}
function renderLogin(){app.innerHTML=`<main class="login-wrap"><section class="login-card"><div class="brand-mark">VL</div><h1>관리자 로그인</h1><p>시설별 관리자 계정으로 로그인하면 해당 시설의 차량, 직원, 운행목적과 월간 운행일지를 관리할 수 있습니다.</p><label class="field"><span>시설 ID</span><input id="loginId" class="input" autocomplete="username" placeholder="예: SEOUL01"></label><label class="field"><span>비밀번호</span><input id="loginPw" class="input" type="password" autocomplete="current-password"></label><button class="btn primary" onclick="adminLogin()">로그인</button><button class="btn light" onclick="location.href='./'">직원 화면으로</button></section></main>`}
window.adminLogin=async function(){const id=document.getElementById("loginId").value.trim().toLowerCase(),password=document.getElementById("loginPw").value;if(!id||!password)return toast("시설 ID와 비밀번호를 입력해주세요.");const email=id==="master"?"fomhr@sc.or.kr":(id.includes("@")?id:id+"@vehiclelog.local");const {error}=await db.auth.signInWithPassword({email,password});if(error)return toast("로그인 정보를 확인해주세요.");renderAdmin()}
async function loadAdminContext(){const {data:{user}}=await db.auth.getUser();const {data:profile,error}=await db.from("profiles").select("id,facility_id,display_name,role").eq("id",user.id).single();if(error)throw error;const [{data:facility},{data:vehicles},{data:members},{data:purposes}]=await Promise.all([db.from("facilities").select("*").eq("id",profile.facility_id).single(),db.from("vehicles").select("*").eq("facility_id",profile.facility_id).order("sort_order"),db.from("facility_members").select("*").eq("facility_id",profile.facility_id).order("sort_order"),db.from("trip_purposes").select("*").eq("facility_id",profile.facility_id).order("sort_order")]);state.admin={profile,facility,vehicles:vehicles||[],members:members||[],purposes:purposes||[]}}
function adminFrame(content){const a=state.admin;app.innerHTML=`<main class="admin-shell"><header class="admin-head"><div><p class="eyebrow">FACILITY ADMIN</p><h1>${esc(a.facility.name)}</h1><p>${esc(a.profile.display_name)} · ${esc(a.facility.code)}</p></div><button class="text-btn" onclick="adminLogout()">로그아웃</button></header><nav class="admin-nav"><button class="${state.adminTab==="dashboard"?"active":""}" onclick="setAdminTab('dashboard')">운행현황</button><button class="${state.adminTab==="vehicles"?"active":""}" onclick="setAdminTab('vehicles')">차량</button><button class="${state.adminTab==="members"?"active":""}" onclick="setAdminTab('members')">직원</button><button class="${state.adminTab==="purposes"?"active":""}" onclick="setAdminTab('purposes')">운행목적</button><button class="${state.adminTab==="report"?"active":""}" onclick="setAdminTab('report')">월간 운행일지</button>${a.profile.role==="superadmin"?`<button class="${state.adminTab==="accounts"?"active":""}" onclick="setAdminTab('accounts')">관리자 계정 등록</button>`:""}</nav><div id="adminContent">${content}</div></main>`}
window.setAdminTab=function(tab){state.adminTab=tab;renderAdminHome()}
window.adminLogout=async function(){await db.auth.signOut();renderLogin()}
async function renderAdminHome(){if(state.adminTab==="dashboard")return renderDashboard();if(state.adminTab==="vehicles")return renderManager("vehicles","차량 관리","plate_number","차량번호");if(state.adminTab==="members")return renderManager("facility_members","직원 관리","name","직원명");if(state.adminTab==="purposes")return renderManager("trip_purposes","운행목적 관리","name","운행목적");if(state.adminTab==="report")return renderReport();if(state.adminTab==="accounts"&&state.admin.profile.role==="superadmin")return renderAccountRegistration()}
async function renderDashboard(){const {data:active}=await db.from("trips").select("id,vehicle_id,driver_id,start_at,destination").eq("facility_id",state.admin.facility.id).eq("status","active").order("start_at");const vm=Object.fromEntries(state.admin.vehicles.map(x=>[x.id,x.plate_number])),mm=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));adminFrame(`<section class="stats"><div class="stat"><span>등록 차량</span><strong>${state.admin.vehicles.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>등록 직원</span><strong>${state.admin.members.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>현재 운행 중</span><strong>${(active||[]).length}</strong></div></section><section class="card"><h2>현재 운행</h2><p>직원 화면의 운행 상태와 실시간으로 동일하게 반영됩니다.</p><div>${(active||[]).map(x=>`<div class="trip-row"><strong>${esc(vm[x.vehicle_id]||"차량")} · ${esc(mm[x.driver_id]||"운행자")}</strong><small>${fmtTime(x.start_at)} 출발 · ${esc(x.destination||"")}</small></div>`).join("")||'<div class="empty" style="margin-top:14px">현재 운행 중인 차량이 없습니다.</div>'}</div></section>`)}
function managerData(table){if(table==="vehicles")return state.admin.vehicles;if(table==="facility_members")return state.admin.members;return state.admin.purposes}
function renderManager(table,title,key,label){const rows=managerData(table);adminFrame(`<section class="card"><h2>${title}</h2><p>저장하면 직원용 화면에 바로 반영됩니다.</p><div style="margin-top:12px">${rows.map(r=>`<div class="manager-row"><div><strong>${esc(r[key])}</strong><br><small>${r.is_active?"사용 중":"사용 안 함"}</small></div><button class="icon-btn" onclick="removeItem('${table}','${r.id}')">삭제</button></div>`).join("")||'<div class="empty">등록된 항목이 없습니다.</div>'}</div><div class="inline-form"><input id="newItem" class="input" placeholder="${label} 입력"><button class="btn primary" onclick="addItem('${table}','${key}')">추가</button></div></section>`)}
window.addItem=async function(table,key){const value=document.getElementById("newItem").value.trim();if(!value)return;const payload={facility_id:state.admin.facility.id,[key]:value,sort_order:managerData(table).length+1};const {error}=await db.from(table).insert(payload);if(error)return toast(error.message);await loadAdminContext();renderAdminHome();toast("추가했습니다.")}
window.removeItem=async function(table,id){if(!confirm("삭제할까요?"))return;const {error}=await db.from(table).delete().eq("id",id);if(error)return toast("운행기록에서 사용 중인 항목은 삭제할 수 없습니다.");await loadAdminContext();renderAdminHome();toast("삭제했습니다.")}

function renderAccountRegistration(){
  adminFrame(`<section class="card"><h2>관리자 계정 등록</h2><p>시설별 관리자 계정 발급을 위한 등록 메뉴입니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>시설명</span><input id="accountFacilityName" class="input" placeholder="예: 서울○○아동보호전문기관"></label><label class="field" style="margin:0"><span>시설 코드</span><input id="accountFacilityCode" class="input" placeholder="예: SEOUL01"></label><label class="field" style="margin:0"><span>관리자 ID</span><input id="accountLoginId" class="input" placeholder="예: SEOUL01"></label></div><label class="field"><span>초기 비밀번호</span><input id="accountPassword" class="input" type="password" minlength="8" placeholder="8자 이상"></label><button class="btn primary" onclick="prepareFacilityAccount()">관리자 계정 등록</button><div id="accountGuide" class="empty" style="display:none;margin-top:14px"></div></section>`);
}
window.prepareFacilityAccount=function(){
  const name=document.getElementById("accountFacilityName").value.trim();
  const code=document.getElementById("accountFacilityCode").value.trim().toUpperCase();
  const login=document.getElementById("accountLoginId").value.trim().toUpperCase();
  const pw=document.getElementById("accountPassword").value;
  if(!name||!code||!login||pw.length<8)return toast("시설명, 시설 코드, 관리자 ID, 8자 이상 비밀번호를 입력해주세요.");
  const box=document.getElementById("accountGuide");
  box.style.display="block";
  box.innerHTML="<strong>"+esc(name)+"</strong><br>시설 코드: "+esc(code)+"<br>관리자 ID: "+esc(login)+"<br><br>계정 등록 정보가 준비되었습니다.";
  toast("관리자 계정 등록 정보가 준비되었습니다.");
}

async function renderReport(){
  const now=new Date().toISOString().slice(0,7);
  adminFrame(`<section class="card"><h2>월간 차량운행일지</h2><p>차량번호와 월을 선택하면 한 달 전체 운행내역이 결재란 포함 양식으로 내려받아집니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>조회 월</span><input id="reportMonth" class="input" type="month" value="${now}"></label><label class="field" style="margin:0"><span>차량</span><select id="reportVehicle" class="select"><option value="">차량 선택</option>${state.admin.vehicles.map(v=>`<option value="${v.id}">${esc(v.plate_number)}</option>`).join("")}</select></label><button class="btn dark" onclick="downloadReport()">결재용 Excel 다운로드</button></div></section>`);
}

window.downloadReport=async function(){
  const month=document.getElementById("reportMonth").value;
  const vehicleId=document.getElementById("reportVehicle").value;
  if(!month||!vehicleId)return toast("조회 월과 차량을 선택해주세요.");

  const start=month+"-01T00:00:00+09:00";
  const endDate=new Date(month+"-01T00:00:00+09:00");
  endDate.setMonth(endDate.getMonth()+1);

  const {data,error}=await db.from("trips").select("*")
    .eq("facility_id",state.admin.facility.id)
    .eq("vehicle_id",vehicleId)
    .eq("status","ended")
    .gte("start_at",start)
    .lt("start_at",endDate.toISOString())
    .order("start_at");
  if(error)return toast(error.message);

  const members=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
  const purposes=Object.fromEntries(state.admin.purposes.map(x=>[x.id,x.name]));
  const vehicle=state.admin.vehicles.find(x=>x.id===vehicleId);
  const rows=data||[];
  const total=rows.reduce((sum,r)=>sum+Number(r.distance||0),0);
  const first=rows[0],last=rows.at(-1);

  const detailRows=rows.map(r=>`<tr>
    <td>${fmtDate(r.start_at)}</td>
    <td>${esc(members[r.driver_id]||"")}</td>
    <td>${esc((r.passenger_ids||[]).map(id=>members[id]).filter(Boolean).join(", "))}</td>
    <td>${esc(purposes[r.purpose_id]||"")}</td>
    <td>${esc(r.destination||"")}</td>
    <td>${fmtTime(r.start_at)}</td>
    <td>${fmtTime(r.end_at)}</td>
    <td>${Number(r.distance||0).toFixed(1)}</td>
    <td>${esc(r.note||"")}</td>
  </tr>`).join("");

  const [y,m]=month.split("-");
  const html=`<html><head><meta charset="utf-8"><style>
    @page{size:A4 landscape;margin:8mm}
    body{font-family:"Malgun Gothic","맑은 고딕",sans-serif;color:#000;margin:0}
    table{border-collapse:collapse;width:100%}
    th,td{border:1px solid #000;padding:5px;text-align:center;vertical-align:middle;font-size:10pt}
    .title-wrap{position:relative;height:76px;display:flex;align-items:center;justify-content:center}
    h1{font-size:24px;letter-spacing:8px;margin:0}
    .approval{position:absolute;right:0;top:0;width:220px;height:70px}
    .approval th,.approval td{height:32px}
    .month{font-weight:bold;font-size:11pt;text-align:center;margin:5px 0 9px}
    .summary th{font-weight:bold}
    .summary td{height:24px}
    .details{margin-top:8px}
    .details th{height:30px}
    .details td{height:27px}
  </style></head><body>
    <div class="title-wrap">
      <h1>차 량 운 행 일 지</h1>
      <table class="approval"><tr><th rowspan="2">결재</th><th>담 당</th><th>팀장</th></tr><tr><td></td><td></td></tr></table>
    </div>
    <div class="month">${y}년 ${Number(m)}월</div>
    <table class="summary">
      <tr><th colspan="2">차 량 번 호</th><td colspan="3">${esc(vehicle?.plate_number||"")}</td><th rowspan="4">유 류 수 불 현 황</th><th>금일급유량</th><td>리터.</td></tr>
      <tr><th rowspan="3" colspan="2">운 행 현 황</th><th>전 일 지 침</th><td>${first?.start_odometer??""}</td><td>km.</td><th>급유액</th><td>원.</td></tr>
      <tr><th>월 운행거리</th><td>${total.toFixed(1)}</td><td>km.</td><th>사용전표</th><td>No.</td></tr>
      <tr><th>월 말 지 침</th><td>${last?.end_odometer??""}</td><td>km.</td><th>누계전표</th><td>총&nbsp;&nbsp;&nbsp;&nbsp;개.</td></tr>
    </table>
    <table class="details">
      <thead><tr><th>일자</th><th>운전자</th><th>승차자</th><th>용무</th><th>행선지</th><th>출발</th><th>도착</th><th>운행거리 (km)</th><th>비고</th></tr></thead>
      <tbody>${detailRows||'<tr><td colspan="9">해당 월 운행기록 없음</td></tr>'}</tbody>
    </table>
  </body></html>`;

  const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=`차량운행일지_결재용_${vehicle?.plate_number||"차량"}_${month}.xls`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast("결재용 월간 차량운행일지를 다운로드했습니다.");
}
(async()=>{if(qs.get("admin")==="1")renderAdmin();else loadPublic()})();