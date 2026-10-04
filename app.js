const SUPABASE_URL="https://ibxckzjregbbtqwjitwj.supabase.co";
const SUPABASE_KEY="sb_publishable_frUifOywlvlSly4Vcmsf8g_zbLzylQd";
const PUBLIC_API=SUPABASE_URL+"/functions/v1/vehicle-log-public";

const app=document.getElementById("app");
const qs=new URLSearchParams(location.search);
const state={facilityCode:(qs.get("facility")||"").trim().toUpperCase(),data:null,selectedVehicle:null,passengers:new Set(),admin:null,adminTab:"dashboard",overview:null,reportEdit:null};

const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),1800)}
async function api(payload){const r=await fetch(PUBLIC_API,{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY},body:JSON.stringify({...payload,facilityCode:state.facilityCode})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"서버 연결에 실패했습니다.");return d}
const fmtTime=v=>v?new Date(v).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false}):"";
const fmtDate=v=>v?new Date(v).toLocaleDateString("ko-KR"):"";

function userShell(body,title="차량 운행일지 등록"){
  app.innerHTML=`<main class="shell staff-shell"><header class="staff-topbar"><strong>차량 운행일지 등록</strong></header>${body}<footer class="staff-brand-footer"><img src="https://www.sc.or.kr/assets/pc/images/intro/about/brand/ci-en_default1.png" alt="Save the Children" referrerpolicy="no-referrer"></footer></main>`
}
async function loadPublic(){if(!state.facilityCode){return renderAdmin()}
try{const d=await api({action:"bootstrap"});state.data=d;renderVehicles()}catch(e){userShell(`<div class="empty">${esc(e.message)}</div>`,"연결 오류")}}

function renderVehicles(){
  const d=state.data;
  const cards=d.vehicles.map(v=>{
    const a=d.active?.[v.id];
    const statusText=a?`${esc(a.driver_name||"운전자")} 운전 중`:"운행 가능";
    return `<button class="vehicle-card ${a?"is-live":""}" onclick="selectVehicle('${v.id}')">
      <div class="vehicle-main">
        <span class="vehicle-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 11.5 6.7 7h10.6l1.7 4.5M4 12.5h16v5H4v-5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 17.5v1.5M17 17.5v1.5M7.2 14.7h.01M16.8 14.7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <div class="vehicle-copy">
          <div class="plate">${esc(v.plate_number)}</div>
          <div class="label">${esc(v.label||d.facility.name)}</div>
          ${a?`<div class="live-meta"><span class="live-dot"></span>${fmtTime(a.start_at)} 출발</div>`:""}
        </div>
      </div>
      <div class="vehicle-card-side"><span class="status-chip ${a?"live":"ok"}">${statusText}</span><span class="vehicle-chevron" aria-hidden="true">›</span></div>
    </button>`;
  }).join("");
  userShell(`<section class="hero vehicle-hero staff-home-hero">
    <div class="facility-accent" aria-hidden="true"></div>
    <h1>${esc(d.facility.name)}</h1>
    <p>운행할 차량을 선택해주세요.</p>
  </section>
  <section class="section-head staff-section-head"><div><span>차량 선택</span><strong>운행할 차량을 골라주세요</strong></div></section>
  <section class="grid vehicle-grid">${cards||'<div class="empty">등록된 차량이 없습니다.</div>'}</section>`,d.facility.name);
}

window.selectVehicle=function(id){state.selectedVehicle=id;state.passengers.clear();const v=state.data.vehicles.find(x=>x.id===id);const a=state.data.active?.[id];if(a)return renderEnd(v,a);renderStart(v)}
function renderStart(v){
  const sortedMembers=[...(state.data.members||[])].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
  const driverOptions=sortedMembers.map(m=>`<button type="button" class="staff-passenger-option staff-driver-option" data-member-name="${esc(m.name)}" data-member-id="${esc(m.id)}" aria-pressed="false" onclick="selectStaffDriver(this)"><span>${esc(m.name)}</span></button>`).join("");
  const purposes=state.data.purposes.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");
  const passengerOptions=sortedMembers.map(m=>`<label class="staff-passenger-option" data-member-name="${esc(m.name)}"><input type="checkbox" value="${esc(m.id)}" onchange="togglePassengerDropdown(this)"><span>${esc(m.name)}</span></label>`).join("");
  userShell(`<button class="back mobile-back" onclick="renderVehicles()">← 차량 다시 선택</button>
  <section class="selected-vehicle-card"><div><span>선택 차량</span><strong>${esc(v.plate_number)}</strong><small>${esc(v.label||state.data.facility.name)}</small></div><span class="status-chip ok">운행 가능</span></section>
  <section class="safety-check-card"><div class="safety-check-title"><span class="safety-number">20</span><div><strong>출발 전 20초 안전확인</strong><p>차량을 움직이기 전에 아래 3가지만 확인해주세요.</p></div></div>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>차량 상태 확인</strong><small>타이어·외관·계기판 경고등에 이상이 없습니다.</small></span></label>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>탑승 안전 확인</strong><small>운전자와 동승자 모두 안전벨트를 착용했습니다.</small></span></label>
    <label class="check-row"><input class="safety-check" type="checkbox" onchange="updateSafetyReady()"><span><strong>안전운전 준비</strong><small>주행 중 휴대전화 조작 없이 교통법규를 준수하겠습니다.</small></span></label>
  </section>
  <div class="card form-card"><div class="card-head"><div><span class="card-kicker">운행 정보</span><h2>출발 기록 입력</h2></div><span class="required-note">필수 입력</span></div>
    <div class="field"><span id="driverFieldLabel">운행자</span>
      <input id="driver" type="hidden" value="">
      <details class="staff-passenger-select" id="staffDriverSelect">
        <summary aria-labelledby="driverFieldLabel driverSummary"><span id="driverSummary">운행자를 선택하세요</span><span class="staff-select-chevron" aria-hidden="true">⌄</span></summary>
        <div class="staff-passenger-menu">
          <label class="staff-member-search"><span class="sr-only">운행자 이름 검색</span><input id="driverSearch" class="input" type="search" placeholder="이름 또는 초성 검색 (예: 김, ㄱㅎ)" autocomplete="off" oninput="filterStaffMembers('driver',this.value)" aria-controls="driverSearchOptions"></label>
          <div id="driverSearchOptions" class="staff-passenger-options">${driverOptions}</div>
          <p id="driverSearchEmpty" class="staff-search-empty" role="status" ${sortedMembers.length?'hidden':''}>${sortedMembers.length?'검색 결과가 없습니다.':'등록된 직원이 없습니다.'}</p>
        </div>
      </details>
    </div>
    <div class="field"><span>동승자 <em>선택</em></span>
      <details class="staff-passenger-select" id="staffPassengerSelect">
        <summary><span id="passengerSummary">동승자를 선택하세요</span><span class="staff-select-chevron" aria-hidden="true">⌄</span></summary>
        <div class="staff-passenger-menu">
          <div class="staff-passenger-menu-head"><strong>동승자 선택</strong><div class="staff-passenger-menu-actions"><button class="passenger-clear-btn" type="button" onclick="clearPassengerDropdown()">선택 해제</button><button id="passengerDoneButton" class="passenger-done-btn" type="button" onclick="finishPassengerDropdown()">선택 완료</button></div></div>
          <label class="staff-member-search"><span class="sr-only">동승자 이름 검색</span><input id="passengerSearch" class="input" type="search" placeholder="이름 또는 초성 검색 (예: 김, ㄱㅎ)" autocomplete="off" oninput="filterStaffMembers('passenger',this.value)" aria-controls="passengerSearchOptions"></label>
          <div id="passengerSearchOptions" class="staff-passenger-options">${passengerOptions}</div>
          <p id="passengerSearchEmpty" class="staff-search-empty" role="status" ${sortedMembers.length?'hidden':''}>${sortedMembers.length?'검색 결과가 없습니다.':'등록된 직원이 없습니다.'}</p>
        </div>
      </details>
      <small class="field-help staff-sort-help">이름·초성으로 검색할 수 있습니다. 선택한 동승자는 검색해도 유지됩니다.</small>
    </div>
    <label class="field"><span>운행목적</span><select id="purpose" class="select" onchange="updateSafetyReady()"><option value="">운행목적을 선택하세요</option>${purposes}</select></label>
    <label class="field"><span>행선지</span><input id="destination" class="input" placeholder="예: 서울중구청 / 방문 가정" oninput="updateSafetyReady()"></label>
    <label class="field"><span>출발 키로수 (km)</span><input id="startKm" class="input" type="number" min="${Number(state.data.lastOdometer?.[v.id]??0)}" step="0.1" inputmode="decimal" value="${state.data.lastOdometer?.[v.id]??""}" placeholder="예: 42351" oninput="updateSafetyReady()"></label>
    ${state.data.lastOdometer?.[v.id]!=null?`<p class="field-help odometer-help">이 차량의 이전 최종 키로수는 <strong>${Number(state.data.lastOdometer[v.id]).toLocaleString()} km</strong>입니다. 실제 계기판 값이 더 크면 수정해주세요.</p>`:""}
  </div>
  <div class="start-action-bar"><button id="startTripButton" class="btn primary" onclick="startTrip()" disabled>안전 체크를 완료해주세요</button></div>`,state.data.facility.name);
  updateSafetyReady();
}
function matchesStaffName(name,query){
  const normalize=value=>String(value||"").normalize("NFC").replace(/\s/g,"").toLowerCase();
  const text=[...normalize(name)],search=[...normalize(query)];
  const initials="ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  if(!search.length)return true;
  return text.some((_,start)=>search.every((char,offset)=>{
    const candidate=text[start+offset];
    if(candidate===undefined)return false;
    if(char===candidate)return true;
    const code=candidate.charCodeAt(0)-0xac00;
    return code>=0&&code<11172&&char===initials[Math.floor(code/588)];
  }));
}
window.filterStaffMembers=function(kind,query){
  const options=document.getElementById(kind+"SearchOptions");
  if(!options)return;
  let count=0;
  options.querySelectorAll("[data-member-name]").forEach(option=>{
    const match=matchesStaffName(option.dataset.memberName,query);
    option.hidden=!match;
    if(match)count++;
  });
  const empty=document.getElementById(kind+"SearchEmpty");
  if(empty){
    empty.hidden=count>0;
    empty.textContent=options.children.length?"검색 결과가 없습니다.":"등록된 직원이 없습니다.";
  }
}
window.selectStaffDriver=function(button){
  const id=button.dataset.memberId;
  const member=state.data?.members?.find(m=>m.id===id);
  if(!member)return;
  document.getElementById("driver").value=id;
  const summary=document.getElementById("driverSummary");
  summary.textContent=member.name;
  summary.classList.add("has-selection");
  document.querySelectorAll(".staff-driver-option").forEach(option=>option.setAttribute("aria-pressed",String(option.dataset.memberId===id)));
  const picker=document.getElementById("staffDriverSelect");
  picker.open=false;
  document.getElementById("driverSearch").blur();
  picker.querySelector("summary").focus();
  updateSafetyReady();
}
function updatePassengerSummary(){
  const summary=document.getElementById("passengerSummary");
  if(!summary)return;
  const sortedMembers=[...(state.data?.members||[])].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
  const names=sortedMembers.filter(m=>state.passengers.has(m.id)).map(m=>m.name);
  summary.textContent=names.length?names.join(", "):"동승자를 선택하세요";
  summary.classList.toggle("has-selection",names.length>0);
  const done=document.getElementById("passengerDoneButton");
  if(done)done.textContent=names.length?("선택 완료 ("+names.length+")"):"선택 완료";
}
window.togglePassengerDropdown=function(input){
  const id=input.value;
  if(input.checked)state.passengers.add(id);
  else state.passengers.delete(id);
  updatePassengerSummary();
}
window.clearPassengerDropdown=function(){
  state.passengers.clear();
  document.querySelectorAll('#staffPassengerSelect input[type="checkbox"]').forEach(input=>input.checked=false);
  updatePassengerSummary();
}
window.finishPassengerDropdown=function(){
  const picker=document.getElementById("staffPassengerSelect");
  updatePassengerSummary();
  if(picker){
    picker.open=false;
    picker.querySelector("summary")?.focus();
  }
}
window.updateSafetyReady=function(){
  const checks=[...document.querySelectorAll(".safety-check")];
  const safetyReady=checks.length>0&&checks.every(x=>x.checked);
  const driver=document.getElementById("driver")?.value||"";
  const purpose=document.getElementById("purpose")?.value||"";
  const destination=document.getElementById("destination")?.value.trim()||"";
  const startRaw=document.getElementById("startKm")?.value;
  const startKm=Number(startRaw);
  const formReady=Boolean(driver&&purpose&&destination&&startRaw!==""&&Number.isFinite(startKm));
  const btn=document.getElementById("startTripButton");
  if(!btn)return;
  btn.disabled=!(safetyReady&&formReady);
  if(!safetyReady)btn.textContent="안전 체크를 완료해주세요";
  else if(!formReady)btn.textContent="운행 정보를 입력해주세요";
  else btn.textContent="운행 시작하기";
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

    <section class="end-expense-section">
      <div class="end-expense-head"><div><span class="card-kicker">추가 비용</span><strong>필요한 항목만 선택하세요</strong></div><small>선택하지 않으면 비용 없이 운행만 종료됩니다.</small></div>
      <div class="end-expense-tabs">
        <button type="button" id="highpassExpenseTab" class="end-expense-tab" aria-pressed="false" onclick="toggleEndExpense('highpass')"><span>하이패스</span><small>통행료가 있었어요</small></button>
        <button type="button" id="fuelExpenseTab" class="end-expense-tab" aria-pressed="false" onclick="toggleEndExpense('fuel')"><span>주유</span><small>주유비가 있었어요</small></button>
      </div>
      <div id="highpassExpenseField" class="end-expense-field" hidden>
        <label class="field"><span>하이패스 비용 (원)</span><input id="highpassCost" class="input" type="number" min="0" step="100" inputmode="numeric" placeholder="예: 5,400"></label>
      </div>
      <div id="fuelExpenseField" class="end-expense-field" hidden>
        <label class="field"><span>주유 비용 (원)</span><input id="fuelCost" class="input" type="number" min="0" step="100" inputmode="numeric" placeholder="예: 70,000"></label>
      </div>
    </section>

    <button class="btn primary" onclick="endTrip('${a.id}')">운행 종료하기</button>
  </div>`,state.data.facility.name);
}
window.toggleEndExpense=function(type){
  const isHighpass=type==="highpass";
  const tab=document.getElementById(isHighpass?"highpassExpenseTab":"fuelExpenseTab");
  const field=document.getElementById(isHighpass?"highpassExpenseField":"fuelExpenseField");
  if(!tab||!field)return;
  const next=tab.getAttribute("aria-pressed")!=="true";
  tab.setAttribute("aria-pressed",next?"true":"false");
  tab.classList.toggle("active",next);
  field.hidden=!next;
  if(!next){
    const input=field.querySelector("input");
    if(input)input.value="";
  }else{
    setTimeout(()=>field.querySelector("input")?.focus(),0);
  }
}
window.endTrip=async function(id){
  const endKmInput=document.getElementById("endKm");
  const endKmRaw=endKmInput?.value?.trim()||"";
  const endOdometer=Number(endKmRaw);
  if(!endKmRaw||!Number.isFinite(endOdometer))return toast("도착 키로수를 입력해주세요.");
  const startOdometer=Number(endKmInput.min);
  if(endOdometer<0||(Number.isFinite(startOdometer)&&endOdometer<startOdometer))return toast("도착 키로수는 출발 키로수보다 작을 수 없습니다.");
  const highpassSelected=document.getElementById("highpassExpenseTab")?.getAttribute("aria-pressed")==="true";
  const fuelSelected=document.getElementById("fuelExpenseTab")?.getAttribute("aria-pressed")==="true";
  const highpassRaw=document.getElementById("highpassCost")?.value??"";
  const fuelRaw=document.getElementById("fuelCost")?.value??"";
  const highpassCost=highpassSelected?(highpassRaw===""?NaN:Number(highpassRaw)):null;
  const fuelCost=fuelSelected?(fuelRaw===""?NaN:Number(fuelRaw)):null;
  if(highpassSelected&&(!Number.isFinite(highpassCost)||highpassCost<0))return toast("하이패스 비용을 입력해주세요.");
  if(fuelSelected&&(!Number.isFinite(fuelCost)||fuelCost<0))return toast("주유 비용을 입력해주세요.");
  try{
    await api({action:"endTrip",tripId:id,endOdometer,highpassCost,fuelCost});
    toast("운행을 종료했습니다.");
    await loadPublic();
  }catch(e){toast(e.message)}
}

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
    const requestedLogin=(qs.get("login")||"").trim().toLowerCase();
    if(readSession()&&requestedLogin){
      try{
        const currentUser=await authUser();
        const email=String(currentUser?.email||"").toLowerCase();
        const currentLogin=email==="fomhr@sc.or.kr"?"master":email.replace(/@vehiclelog\.local$/,"");
        if(currentLogin!==requestedLogin){
          await signOut();
          state.admin=null;
          return renderLogin();
        }
      }catch(_){
        writeSession(null);
        state.admin=null;
        return renderLogin();
      }
    }
    if(!readSession())return renderLogin();
    await loadAdminContext();
    return renderAdminHome();
  }catch(error){
    console.error("admin render failed",error);
    writeSession(null);
    state.admin=null;
    renderLogin();
    setTimeout(()=>toast("세션을 초기화했습니다. 다시 로그인해주세요."),50);
  }
}
function renderLogin(){
  const sharedLogin=(qs.get("login")||"").trim().toUpperCase();
  const savedLogin=(localStorage.getItem("vehiclelog_admin_id")||"").trim().toUpperCase();
  const loginValue=sharedLogin||savedLogin;
  const rememberChecked=Boolean(savedLogin);
  app.innerHTML=`<main class="login-wrap"><section class="login-card admin-login-card"><div class="login-brand">차량 운행일지 관리</div><h1>관리자 로그인</h1><p>시설 관리자와 시스템 관리자가 사용하는 관리 페이지입니다. 직원 운행등록은 시설별 전용 링크에서 이용합니다.</p><label class="field"><span>시설 ID</span><input id="loginId" class="input" autocomplete="username" placeholder="예: JB" value="${esc(loginValue)}" ${loginValue?"":"autofocus"}></label><label class="field"><span>비밀번호</span><input id="loginPw" class="input" type="password" autocomplete="current-password" ${loginValue?"autofocus":""}></label><label class="remember-login"><input id="rememberLoginId" type="checkbox" ${rememberChecked?"checked":""}><span>이 브라우저에 시설 ID 저장</span></label><button class="btn primary" onclick="adminLogin()">로그인</button></section></main>`;
}
window.adminLogin=async function(){
  const id=document.getElementById("loginId").value.trim().toLowerCase();
  const password=document.getElementById("loginPw").value;
  const remember=document.getElementById("rememberLoginId")?.checked===true;
  if(!id||!password)return toast("시설 ID와 비밀번호를 입력해주세요.");
  const email=id==="master"?"fomhr@sc.or.kr":(id.includes("@")?id:id+"@vehiclelog.local");
  const button=document.querySelector('[onclick="adminLogin()"]');
  if(button){button.disabled=true;button.textContent="로그인 중...";}
  try{
    await signIn(email,password);
    await loadAdminContext();
    if(remember)localStorage.setItem("vehiclelog_admin_id",id.toUpperCase());
    else localStorage.removeItem("vehiclelog_admin_id");
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
    restRequest("trip_purposes?select=*&facility_id=is.null&order=sort_order.asc,name.asc")
  ]);
  const facility=facilities?.[0];
  if(!facility)throw new Error("시설 정보를 찾을 수 없습니다.");
  state.admin={profile,facility,vehicles:vehicles||[],members:members||[],purposes:purposes||[]};
}
function adminFrame(content){
  const a=state.admin;
  const isMaster=a.profile.role==="superadmin";
  const masterNav=isMaster?`<button class="${state.adminTab==="purposes"?"active":""}" onclick="setAdminTab('purposes')">운행목적</button><button class="${state.adminTab==="accounts"?"active":""}" onclick="setAdminTab('accounts')">관리자 계정 등록</button>`:"";
  const resetButton=isMaster?`<button class="text-btn reset-data-btn" onclick="resetAllTripData()">운행 데이터 초기화</button>`:"";
  const facilityTools=!isMaster?`<button class="text-btn share-staff-btn" onclick="openFacilityShare()">직원 공유 링크</button><button class="text-btn" onclick="openOwnPasswordChange()">비밀번호 변경</button>`:"";
  app.innerHTML=`<main class="admin-shell"><header class="admin-head"><div><p class="eyebrow">${isMaster?"SYSTEM ADMIN":"FACILITY ADMIN"}</p><h1>${esc(a.facility.name)}</h1><p>${esc(a.profile.display_name)} · ${esc(a.facility.code)}</p></div><div class="admin-head-actions">${a.facility.code!=="HQ"?`<button class="text-btn preview-btn" onclick="previewFacility('${encodeURIComponent(a.facility.code)}')">담당자 화면 미리보기</button>`:""}${facilityTools}${resetButton}<button class="text-btn" onclick="adminLogout()">로그아웃</button></div></header><nav class="admin-nav"><button class="${state.adminTab==="dashboard"?"active":""}" onclick="setAdminTab('dashboard')">운행현황</button><button class="${state.adminTab==="vehicles"?"active":""}" onclick="setAdminTab('vehicles')">차량</button><button class="${state.adminTab==="maintenance"?"active":""}" onclick="setAdminTab('maintenance')">정비 이력</button><button class="${state.adminTab==="members"?"active":""}" onclick="setAdminTab('members')">직원</button><button class="${state.adminTab==="report"?"active":""}" onclick="setAdminTab('report')">월간 운행일지</button>${masterNav}</nav><div id="adminContent">${content}</div></main>`;
}
window.setAdminTab=function(tab){state.adminTab=tab;renderAdminHome()}
window.adminLogout=async function(){await signOut();state.admin=null;renderLogin()}
window.previewFacility=function(encodedCode){
  const code=decodeURIComponent(encodedCode);
  const url=location.origin+location.pathname+"?facility="+encodeURIComponent(code);
  window.open(url,"_blank","noopener");
}
function employeeShareUrl(code){
  return location.origin+location.pathname+"?facility="+encodeURIComponent(code);
}
function closeAdminModal(){
  document.getElementById("adminModal")?.remove();
}
window.closeAdminModal=closeAdminModal;

function showAdminModal(inner){
  closeAdminModal();
  document.body.insertAdjacentHTML("beforeend",`<div id="adminModal" class="admin-modal-backdrop" onclick="if(event.target===this)closeAdminModal()"><section class="admin-modal" role="dialog" aria-modal="true">${inner}</section></div>`);
}

window.openFacilityShare=function(){
  const f=state.admin?.facility;
  if(!f||state.admin?.profile?.role==="superadmin")return;
  const url=employeeShareUrl(f.code);
  showAdminModal(`<div class="admin-modal-head"><div><span class="modal-kicker">직원용 접속</span><h2>직원 공유용 링크</h2><p>${esc(f.name)} 직원이 차량 운행일지를 등록할 때 사용하는 전용 주소입니다.</p></div><button class="modal-close" onclick="closeAdminModal()" aria-label="닫기">×</button></div>
    <div class="share-link-box"><label>직원용 주소</label><div class="share-line"><input class="input" readonly value="${esc(url)}"><div class="share-line-actions"><button class="icon-btn" onclick="copyShareLink('${encodeURIComponent(url)}')">링크 복사</button></div></div></div>
    <div class="qr-share-card"><canvas id="staffShareQr" width="260" height="260"></canvas><div><strong>QR로 바로 접속</strong><p>QR을 스캔하면 별도 로그인 없이 이 시설의 차량 선택 화면으로 이동합니다.</p><button class="btn primary qr-download-btn" onclick="downloadStaffQr('${encodeURIComponent(f.code)}','${encodeURIComponent(f.name)}')">QR 이미지 다운로드</button></div></div>`);
  renderStaffQr(url,"staffShareQr");
}

function renderStaffQr(url,canvasId){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;
  if(!window.QRCode?.toCanvas){
    const ctx=canvas.getContext("2d");
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#f8f5f6";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="#6b5c60";
    ctx.font="14px sans-serif";
    ctx.textAlign="center";
    ctx.fillText("QR 모듈을 불러오지 못했습니다.",canvas.width/2,canvas.height/2);
    return;
  }
  window.QRCode.toCanvas(canvas,url,{width:260,margin:2,errorCorrectionLevel:"M",color:{dark:"#111111",light:"#ffffff"}},()=>{});
}

window.downloadStaffQr=async function(encodedCode,encodedName){
  const code=decodeURIComponent(encodedCode);
  const name=decodeURIComponent(encodedName||encodedCode);
  const url=employeeShareUrl(code);
  if(!window.QRCode?.toDataURL)return toast("QR 생성 모듈을 불러오지 못했습니다.");
  try{
    const dataUrl=await window.QRCode.toDataURL(url,{width:720,margin:3,errorCorrectionLevel:"M",color:{dark:"#111111",light:"#ffffff"}});
    const a=document.createElement("a");
    a.href=dataUrl;
    a.download=(name||code).replace(/[\\/:*?"<>|]/g,"_")+"_직원용_QR.png";
    a.click();
    toast("직원용 QR 이미지를 다운로드했습니다.");
  }catch(error){toast("QR 이미지를 만들지 못했습니다.");}
}

window.openOwnPasswordChange=function(){
  if(state.admin?.profile?.role==="superadmin")return;
  showAdminModal(`<div class="admin-modal-head"><div><span class="modal-kicker">계정 보안</span><h2>비밀번호 변경</h2><p>현재 로그인된 시설 관리자 계정의 새 비밀번호를 입력하세요.</p></div><button class="modal-close" onclick="closeAdminModal()" aria-label="닫기">×</button></div>
    <label class="field"><span>새 비밀번호</span><input id="ownNewPassword" class="input" type="password" autocomplete="new-password" placeholder="새 비밀번호 입력"></label>
    <label class="field"><span>새 비밀번호 확인</span><input id="ownNewPasswordConfirm" class="input" type="password" autocomplete="new-password" placeholder="한 번 더 입력"></label>
    <div class="modal-actions"><button class="btn light" onclick="closeAdminModal()">취소</button><button class="btn primary" onclick="saveOwnPassword()">비밀번호 변경</button></div>`);
  setTimeout(()=>document.getElementById("ownNewPassword")?.focus(),0);
}

window.saveOwnPassword=async function(){
  const pw=document.getElementById("ownNewPassword")?.value||"";
  const confirmPw=document.getElementById("ownNewPasswordConfirm")?.value||"";
  if(!pw)return toast("새 비밀번호를 입력해주세요.");
  if(pw!==confirmPw)return toast("비밀번호가 서로 다릅니다.");
  const button=document.querySelector('[onclick="saveOwnPassword()"]');
  if(button){button.disabled=true;button.textContent="변경 중...";}
  try{
    const session=await validSession();
    const r=await fetch(SUPABASE_URL+"/auth/v1/user",{
      method:"PUT",
      headers:{"Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+session.access_token},
      body:JSON.stringify({password:pw})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.msg||data.message||data.error_description||"비밀번호를 변경하지 못했습니다.");
    closeAdminModal();
    await signOut();
    state.admin=null;
    renderLogin();
    setTimeout(()=>toast("비밀번호를 변경했습니다. 새 비밀번호로 다시 로그인해주세요."),50);
  }catch(error){
    toast(error.message||"비밀번호를 변경하지 못했습니다.");
    if(button){button.disabled=false;button.textContent="비밀번호 변경";}
  }
}

window.openMasterAccountEdit=function(encodedUserId,encodedName,encodedCode,encodedLoginId){
  if(state.admin?.profile?.role!=="superadmin")return;
  const userId=decodeURIComponent(encodedUserId);
  const name=decodeURIComponent(encodedName);
  const code=decodeURIComponent(encodedCode);
  const loginId=decodeURIComponent(encodedLoginId);
  showAdminModal(`<div class="admin-modal-head"><div><span class="modal-kicker">MASTER 권한</span><h2>관리자 계정 정보 수정</h2><p><strong>${esc(name)}</strong> 시설의 접속 코드와 관리자 로그인 정보를 변경합니다.</p></div><button class="modal-close" onclick="closeAdminModal()" aria-label="닫기">×</button></div>
    <div class="account-edit-grid">
      <label class="field"><span>시설 코드</span><input id="masterEditFacilityCode" class="input" value="${esc(code)}" autocomplete="off" placeholder="예: JB"></label>
      <label class="field"><span>관리자 ID</span><input id="masterEditLoginId" class="input" value="${esc(loginId)}" autocomplete="off" placeholder="예: JB"></label>
    </div>
    <label class="field"><span>새 비밀번호 <em>선택</em></span><input id="masterEditPassword" class="input" type="password" autocomplete="new-password" placeholder="변경할 때만 입력"></label>
    <label class="field"><span>새 비밀번호 확인</span><input id="masterEditPasswordConfirm" class="input" type="password" autocomplete="new-password" placeholder="비밀번호를 변경할 경우 한 번 더 입력"></label>
    <input type="hidden" id="masterEditUserId" value="${esc(userId)}">
    <input type="hidden" id="masterEditOriginalCode" value="${esc(code)}">
    <input type="hidden" id="masterEditOriginalLoginId" value="${esc(loginId)}">
    <div class="modal-note account-edit-warning"><strong>변경 시 주의</strong><br>시설 코드를 바꾸면 기존 직원용 QR·공유 링크는 새 코드로 다시 배포해야 합니다. 관리자 ID를 바꾸면 기존 ID로는 로그인할 수 없습니다.</div>
    <div class="modal-actions"><button class="btn light" onclick="closeAdminModal()">취소</button><button class="btn primary" onclick="saveMasterAccountEdit()">변경사항 저장</button></div>`);
  setTimeout(()=>document.getElementById("masterEditFacilityCode")?.focus(),0);
}

window.saveMasterAccountEdit=async function(){
  if(state.admin?.profile?.role!=="superadmin")return toast("최고관리자만 사용할 수 있습니다.");
  const userId=document.getElementById("masterEditUserId")?.value||"";
  const facilityCode=(document.getElementById("masterEditFacilityCode")?.value||"").trim().toUpperCase();
  const loginId=(document.getElementById("masterEditLoginId")?.value||"").trim().toUpperCase();
  const password=document.getElementById("masterEditPassword")?.value||"";
  const confirmPassword=document.getElementById("masterEditPasswordConfirm")?.value||"";
  const originalCode=document.getElementById("masterEditOriginalCode")?.value||"";
  const originalLoginId=document.getElementById("masterEditOriginalLoginId")?.value||"";

  if(!userId||!facilityCode||!loginId)return toast("시설 코드와 관리자 ID를 입력해주세요.");
  if(password!==confirmPassword)return toast("비밀번호가 서로 다릅니다.");
  if(facilityCode===originalCode&&loginId===originalLoginId&&!password)return toast("변경할 내용이 없습니다.");

  const button=document.querySelector('[onclick="saveMasterAccountEdit()"]');
  if(button){button.disabled=true;button.textContent="저장 중...";}
  try{
    const result=await callAdminApi({
      action:"updateAccount",
      userId,
      facilityCode,
      loginId,
      password
    });
    closeAdminModal();
    state.overview=null;
    await loadAdminAccounts();
    const changed=[];
    if(result.facilityCode&&result.facilityCode!==originalCode)changed.push("시설 코드");
    if(result.loginId&&result.loginId!==originalLoginId)changed.push("관리자 ID");
    if(password)changed.push("비밀번호");
    toast((changed.length?changed.join(" · "):"계정 정보")+"를 변경했습니다.");
  }catch(error){
    toast(error.message||"계정 정보를 변경하지 못했습니다.");
    if(button){button.disabled=false;button.textContent="변경사항 저장";}
  }
}

window.resetAllTripData=async function(){
  if(state.admin?.profile?.role!=="superadmin")return toast("최고관리자만 사용할 수 있습니다.");
  const first=confirm("모든 시설의 운행일지 데이터를 초기화할까요?\n\n시설·차량·직원·운행목적·관리자 계정은 유지되고, 운행기록만 삭제됩니다.");
  if(!first)return;
  const keyword=prompt("삭제를 진행하려면 아래 입력창에 초기화 를 입력해주세요.\n이 작업은 되돌릴 수 없습니다.");
  if(keyword!=="초기화")return toast("데이터 초기화를 취소했습니다.");
  const buttons=[...document.querySelectorAll('[onclick="resetAllTripData()"]')];
  buttons.forEach(b=>{b.disabled=true;b.dataset.label=b.textContent;b.textContent="초기화 중...";});
  try{
    const result=await callAdminApi({action:"resetTrips"});
    state.overview=null;
    state.reportEdit=null;
    toast(`운행기록 ${Number(result.deletedCount||0).toLocaleString()}건을 초기화했습니다.`);
    await renderDashboard();
  }catch(error){
    toast(error.message||"운행 데이터를 초기화하지 못했습니다.");
  }finally{
    buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.label||"운행 데이터 초기화";});
  }
}
async function getOverview(force=false){
  if(state.admin?.profile?.role!=="superadmin")return null;
  if(!force&&state.overview)return state.overview;
  state.overview=await callAdminApi({action:"overview"});
  return state.overview;
}
async function renderAdminHome(){
  if(state.admin.profile.role!=="superadmin"&&(state.adminTab==="purposes"||state.adminTab==="accounts")){
    state.adminTab="dashboard";
  }
  if(state.adminTab==="dashboard")return renderDashboard();
  if(state.adminTab==="vehicles")return state.admin.profile.role==="superadmin"?renderGlobalManager("vehicles"):renderManager("vehicles","차량 관리","plate_number","차량번호");
  if(state.adminTab==="maintenance")return renderMaintenanceHistory();
  if(state.adminTab==="members")return state.admin.profile.role==="superadmin"?renderGlobalManager("members"):renderManager("facility_members","직원 관리","name","직원명");
  if(state.adminTab==="purposes")return state.admin.profile.role==="superadmin"?renderGlobalPurposeManager():renderPurposeReadOnly();
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

  const active=await restRequest("trips?select=id,vehicle_id,driver_id,start_at,destination&facility_id="+eq(state.admin.facility.id)+"&status=eq.active&order=admin_sort_order.asc.nullslast,start_at.asc");
  const vm=Object.fromEntries(state.admin.vehicles.map(x=>[x.id,x.plate_number]));
  const mm=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
  adminFrame(`<section class="stats"><div class="stat"><span>등록 차량</span><strong>${state.admin.vehicles.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>등록 직원</span><strong>${state.admin.members.filter(x=>x.is_active).length}</strong></div><div class="stat"><span>현재 운행 중</span><strong>${(active||[]).length}</strong></div></section><section class="card"><h2>현재 운행</h2><p>직원 화면의 운행 상태와 실시간으로 동일하게 반영됩니다.</p><div>${(active||[]).map(x=>`<div class="trip-row"><strong>${esc(vm[x.vehicle_id]||"차량")} · ${esc(mm[x.driver_id]||"운행자")}</strong><small>${fmtTime(x.start_at)} 출발 · ${esc(x.destination||"")}</small></div>`).join("")||'<div class="empty" style="margin-top:14px">현재 운행 중인 차량이 없습니다.</div>'}</div></section>`);
}

function currentKstMonth(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit"}).formatToParts(new Date());
  const m=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return m.year+"-"+m.month;
}
function currentKstDate(){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const d=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return d.year+"-"+d.month+"-"+d.day;
}
function formatUsageMinutes(value){
  const minutes=Math.max(0,Math.round(Number(value)||0));
  const hours=Math.floor(minutes/60);
  const rest=minutes%60;
  if(hours&&rest)return hours.toLocaleString()+"시간 "+rest+"분";
  if(hours)return hours.toLocaleString()+"시간";
  return rest+"분";
}
function usageMetricMarkup(metric,scope){
  const minutes=scope==="month"?metric?.month_minutes:metric?.total_minutes;
  const distance=scope==="month"?metric?.month_distance:metric?.total_distance;
  return `<div class="usage-metric"><strong>${formatUsageMinutes(minutes)}</strong><small>${Number(distance||0).toLocaleString()} km</small></div>`;
}
async function loadVehicleUsageMetrics(month){
  const rows=await restRequest("rpc/get_vehicle_usage_metrics",{method:"POST",body:JSON.stringify({p_month:month})});
  return Object.fromEntries((rows||[]).map(r=>[r.vehicle_id,r]));
}
window.changeVehicleMetricMonth=function(value){
  if(!/^\d{4}-\d{2}$/.test(value||""))return;
  state.vehicleMetricMonth=value;
  state.adminTab="vehicles";
  renderAdminHome();
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

    const facilities=[...(o.facilities||[])].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ko"));
    const savedFilter=state.globalFacilityFilters?.[type]||"";
    const selectedFilter=facilities.some(f=>f.id===savedFilter)?savedFilter:"";
    const filterOptions=facilities.map(f=>`<option value="${esc(f.id)}" ${f.id===selectedFilter?'selected':''}>${esc(f.name)} (${esc(f.code)})</option>`).join("");
    const facilityOptions=(o.facilities||[]).map(f=>`<option value="${f.id}">${esc(f.name)} (${esc(f.code)})</option>`).join("");
    const odometerMap=o.vehicleOdometers||{};
    const activeVehicleIds=new Set((o.activeTrips||[]).map(t=>t.vehicle_id));
    const metricMonth=state.vehicleMetricMonth||currentKstMonth();
    const metricMap=type==="vehicles"?await loadVehicleUsageMetrics(metricMonth):{};
    const monthLabel=Number(metricMonth.split("-")[1])+"월";

    const body=rows.map(r=>{
      const f=facilityMap[r.facility_id]||{};
      const value=r[cfg.key]||"";
      const sub=type==="vehicles"?(r.label||""):"";
      const odometer=type==="vehicles"?odometerMap[r.id]:null;
      const odometerCell=type==="vehicles"
        ?`<td class="odometer-cell"><strong>${odometer!=null?Number(odometer).toLocaleString()+" km":"—"}</strong>${activeVehicleIds.has(r.id)?'<small>직전 운행 종료 기준</small>':""}</td>`
        :"";
      const usageCells=type==="vehicles"
        ?`<td>${usageMetricMarkup(metricMap[r.id],"month")}</td><td>${usageMetricMarkup(metricMap[r.id],"total")}</td>`
        :"";
      return `<tr data-facility-id="${esc(r.facility_id||'')}"><td><strong>${esc(f.name||"미지정")}</strong><small>${esc(f.code||"")}</small></td><td><strong>${esc(value)}</strong>${sub?`<small>${esc(sub)}</small>`:""}</td><td>${r.is_active?"사용 중":"사용 안 함"}</td>${odometerCell}${usageCells}<td><div class="row-actions"><button class="icon-btn" onclick="editItem('${cfg.table}','${r.id}','${cfg.key}','${encodeURIComponent(value)}')">수정</button><button class="icon-btn danger" onclick="removeItem('${cfg.table}','${r.id}')">삭제</button></div></td></tr>`;
    }).join("");

    const memberBulk=type==="members"?`<button class="btn bulk-btn" onclick="downloadMemberTemplate(true)">업로드 양식 다운로드</button><button class="btn bulk-btn emphasis" onclick="uploadMemberTemplate(true)">양식으로 첨부하기</button>`:"";
    const odometerHead=type==="vehicles"?"<th>누적 키로수</th>":"";
    const usageHead=type==="vehicles"?`<th>${monthLabel} 운행</th><th>전체 누적</th>`:"";
    const colCount=type==="vehicles"?7:4;
    const monthControl=type==="vehicles"?`<label class="vehicle-metric-month"><span>월 운행 기준</span><input class="input" type="month" value="${metricMonth}" onchange="changeVehicleMetricMonth(this.value)"></label>`:"";
    const facilityFilter=(type==="vehicles"||type==="members")?`<div class="global-facility-filter"><label><span>시설별 조회</span><select id="globalFacilityFilter" class="select" onchange="filterGlobalFacility('${type}',this.value)"><option value="">전체 시설</option>${filterOptions}</select></label><span id="globalFacilityCount" class="global-facility-count" role="status"></span></div>`:"";
    adminFrame(`<section class="card"><div class="vehicle-manager-head"><div><h2>${cfg.title}</h2><p>최고관리자는 관리자 계정에 등록된 모든 시설의 데이터를 조회·입력·수정·삭제할 수 있습니다.${type==="vehicles"?" 월별 운행시간·주행거리와 전체 누적 실적을 함께 확인할 수 있습니다.":""}${type==="members"?" 시설을 선택한 뒤 엑셀 양식으로 직원명을 일괄 등록할 수 있습니다.":""}</p></div>${monthControl}</div>${facilityFilter}<div class="global-add-form ${type==="members"?"global-member-add":""}"><select id="globalFacility" class="select"><option value="">시설 선택</option>${facilityOptions}</select><input id="globalValue" class="input" placeholder="${cfg.label} 입력"><button class="btn primary" onclick="addGlobalItem('${type}')">추가</button>${memberBulk}</div><div class="table-scroll"><table class="admin-table vehicle-usage-table"><thead><tr><th>시설명</th><th>${cfg.label}</th><th>상태</th>${odometerHead}${usageHead}<th>관리</th></tr></thead><tbody id="globalManagerRows">${body}<tr id="globalFacilityEmpty" ${rows.length?'hidden':''}><td colspan="${colCount}">등록된 데이터가 없습니다.</td></tr></tbody></table></div></section>`);
    if(type==="vehicles"||type==="members")filterGlobalFacility(type,selectedFilter);
  }catch(error){adminFrame('<div class="empty">'+esc(error.message||"목록을 불러오지 못했습니다.")+'</div>')}
}
window.filterGlobalFacility=function(type,facilityId){
  if(state.admin?.profile?.role!=="superadmin"||!["vehicles","members"].includes(type))return;
  state.globalFacilityFilters=state.globalFacilityFilters||{};
  state.globalFacilityFilters[type]=facilityId||"";
  const rows=[...document.querySelectorAll("#globalManagerRows tr[data-facility-id]")];
  let visible=0;
  rows.forEach(row=>{
    row.hidden=Boolean(facilityId&&row.dataset.facilityId!==facilityId);
    if(!row.hidden)visible++;
  });
  const count=document.getElementById("globalFacilityCount");
  if(count)count.textContent="조회 "+visible+(type==="vehicles"?"대":"명")+" / 전체 "+rows.length+(type==="vehicles"?"대":"명");
  const empty=document.getElementById("globalFacilityEmpty");
  if(empty){
    empty.hidden=visible>0;
    empty.querySelector("td").textContent=facilityId?"선택한 시설에 등록된 데이터가 없습니다.":"등록된 데이터가 없습니다.";
  }
}
async function renderGlobalPurposeManager(){
  adminFrame('<div class="empty">공통 운행목적을 불러오는 중입니다.</div>');
  try{
    const rows=await restRequest("trip_purposes?select=*&facility_id=is.null&order=sort_order.asc,name.asc");
    const body=(rows||[]).map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${r.is_active?"사용 중":"사용 안 함"}</td><td><div class="row-actions"><button class="icon-btn" onclick="editItem('trip_purposes','${r.id}','name','${encodeURIComponent(r.name||"")}')">수정</button><button class="icon-btn danger" onclick="removeItem('trip_purposes','${r.id}')">삭제</button></div></td></tr>`).join("");
    adminFrame(`<section class="card"><h2>공통 운행목적 코드</h2><p>운행목적은 시설별로 따로 만들지 않습니다. MASTER에서 관리한 공통 코드가 모든 시설 직원 화면에 동일하게 적용됩니다.</p><div class="global-add-form global-purpose-add"><input id="globalPurposeValue" class="input" placeholder="운행목적 입력"><button class="btn primary" onclick="addGlobalPurpose()">추가</button></div><div class="table-scroll"><table class="admin-table"><thead><tr><th>운행목적</th><th>상태</th><th>관리</th></tr></thead><tbody>${body||'<tr><td colspan="3">등록된 운행목적이 없습니다.</td></tr>'}</tbody></table></div></section>`);
  }catch(error){
    adminFrame('<div class="empty">'+esc(error.message||"운행목적을 불러오지 못했습니다.")+'</div>');
  }
}
window.addGlobalPurpose=async function(){
  const value=document.getElementById("globalPurposeValue")?.value.trim();
  if(!value)return toast("운행목적을 입력해주세요.");
  try{
    const existing=await restRequest("trip_purposes?select=id,name&facility_id=is.null&name="+eq(value));
    if(existing?.length)return toast("이미 등록된 운행목적입니다.");
    const current=await restRequest("trip_purposes?select=id,sort_order&facility_id=is.null&order=sort_order.desc&limit=1");
    const nextSort=(Number(current?.[0]?.sort_order)||0)+1;
    await restRequest("trip_purposes",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify({facility_id:null,name:value,is_active:true,sort_order:nextSort})});
    toast("공통 운행목적을 추가했습니다.");
    await renderGlobalPurposeManager();
  }catch(error){toast(error.message||"운행목적을 추가하지 못했습니다.")}
}

function renderPurposeReadOnly(){
  const rows=state.admin.purposes||[];
  adminFrame(`<section class="card"><h2>운행목적</h2><p>운행목적은 MASTER가 공통 코드로 관리합니다. 모든 시설에 동일한 항목이 적용되며 시설 관리자는 조회만 할 수 있습니다.</p><div style="margin-top:12px">${rows.map(r=>`<div class="manager-row"><div><strong>${esc(r.name)}</strong><br><small>${r.is_active?"사용 중":"사용 안 함"}</small></div><span class="status-chip ok">공통 코드</span></div>`).join("")||'<div class="empty">등록된 운행목적이 없습니다. 시스템 관리자에게 문의해주세요.</div>'}</div></section>`);
}

function managerData(table){
  if(table==="vehicles")return state.admin.vehicles;
  if(table==="facility_members")return state.admin.members;
  return state.admin.purposes;
}
async function renderManager(table,title,key,label){
  const rows=managerData(table);
  const memberBulk=table==="facility_members"?`<button class="btn bulk-btn" onclick="downloadMemberTemplate(false)">업로드 양식 다운로드</button><button class="btn bulk-btn emphasis" onclick="uploadMemberTemplate(false)">양식으로 첨부하기</button>`:"";

  if(table==="vehicles"){
    adminFrame('<div class="empty">차량 운행 실적을 확인하는 중입니다.</div>');
    let odometerMap={};
    let activeVehicleIds=new Set();
    const metricMonth=state.vehicleMetricMonth||currentKstMonth();
    const monthLabel=Number(metricMonth.split("-")[1])+"월";
    let metricMap={};
    try{
      const [odometerRows,activeTrips,metrics]=await Promise.all([
        Promise.all(rows.map(async vehicle=>{
          const result=await restRequest("trips?select=vehicle_id,end_odometer,end_at&facility_id="+eq(state.admin.facility.id)+"&vehicle_id="+eq(vehicle.id)+"&status=eq.ended&end_odometer=not.is.null&order=end_at.desc&limit=1");
          return result?.[0]||null;
        })),
        restRequest("trips?select=vehicle_id&facility_id="+eq(state.admin.facility.id)+"&status=eq.active"),
        loadVehicleUsageMetrics(metricMonth)
      ]);
      odometerMap=Object.fromEntries(odometerRows.filter(Boolean).map(t=>[t.vehicle_id,t.end_odometer]));
      activeVehicleIds=new Set((activeTrips||[]).map(t=>t.vehicle_id));
      metricMap=metrics;
    }catch(error){
      console.warn("vehicle usage lookup failed",error);
    }

    const body=rows.map(r=>{
      const odometer=odometerMap[r.id];
      return `<tr><td><strong>${esc(r[key])}</strong>${r.label?`<small>${esc(r.label)}</small>`:""}</td><td>${r.is_active?"사용 중":"사용 안 함"}</td><td class="odometer-cell"><strong>${odometer!=null?Number(odometer).toLocaleString()+" km":"—"}</strong>${activeVehicleIds.has(r.id)?'<small>직전 운행 종료 기준</small>':""}</td><td>${usageMetricMarkup(metricMap[r.id],"month")}</td><td>${usageMetricMarkup(metricMap[r.id],"total")}</td><td><div class="row-actions"><button class="icon-btn" onclick="editItem('${table}','${r.id}','${key}','${encodeURIComponent(r[key]||"")}')">수정</button><button class="icon-btn danger" onclick="removeItem('${table}','${r.id}')">삭제</button></div></td></tr>`;
    }).join("");
    adminFrame(`<section class="card"><div class="vehicle-manager-head"><div><h2>${title}</h2><p>${esc(state.admin.facility.name)}에 등록된 차량만 표시됩니다. 월별 운행시간·주행거리와 전체 누적 실적을 확인할 수 있습니다. 누적 키로수는 가장 최근 종료 기록 기준입니다.</p></div><label class="vehicle-metric-month"><span>월 운행 기준</span><input class="input" type="month" value="${metricMonth}" onchange="changeVehicleMetricMonth(this.value)"></label></div><div class="table-scroll" style="margin-top:12px"><table class="admin-table vehicle-admin-table vehicle-usage-table"><thead><tr><th>차량번호</th><th>상태</th><th>누적 키로수</th><th>${monthLabel} 운행</th><th>전체 누적</th><th>관리</th></tr></thead><tbody>${body||'<tr><td colspan="6">등록된 차량이 없습니다.</td></tr>'}</tbody></table></div><div class="inline-form"><input id="newItem" class="input" placeholder="${label} 입력"><button class="btn primary" onclick="addItem('${table}','${key}')">추가</button></div></section>`);
    return;
  }

  adminFrame(`<section class="card"><h2>${title}</h2><p>${esc(state.admin.facility.name)}에 등록된 항목만 표시됩니다. 입력·수정·삭제한 내용은 해당 시설의 직원용 화면에 바로 반영됩니다.${table==="facility_members"?" 직원이 많으면 엑셀 양식으로 한 번에 등록할 수 있습니다.":""}</p><div style="margin-top:12px">${rows.map(r=>`<div class="manager-row"><div><strong>${esc(r[key])}</strong><br><small>${r.is_active?"사용 중":"사용 안 함"}</small></div><div class="row-actions"><button class="icon-btn" onclick="editItem('${table}','${r.id}','${key}','${encodeURIComponent(r[key]||"")}')">수정</button><button class="icon-btn danger" onclick="removeItem('${table}','${r.id}')">삭제</button></div></div>`).join("")||'<div class="empty">등록된 항목이 없습니다.</div>'}</div><div class="inline-form ${table==="facility_members"?"member-add-form":""}"><input id="newItem" class="input" placeholder="${label} 입력"><button class="btn primary" onclick="addItem('${table}','${key}')">추가</button>${memberBulk}</div></section>`);
}
async function renderMaintenanceHistory(){
  adminFrame('<div class="empty">차량 정비 이력을 불러오는 중입니다.</div>');
  try{
    const isMaster=state.admin.profile.role==="superadmin";
    let vehicles=state.admin.vehicles||[];
    let facilities=[state.admin.facility];

    if(isMaster){
      const o=await getOverview(true);
      vehicles=o.vehicles||[];
      facilities=o.facilities||[];
    }

    const facilityMap=Object.fromEntries(facilities.map(f=>[f.id,f]));
    const vehicleMap=Object.fromEntries(vehicles.map(v=>[v.id,v]));
    const sortedVehicles=vehicles
      .slice()
      .sort((a,b)=>{
        const af=facilityMap[a.facility_id]?.name||"";
        const bf=facilityMap[b.facility_id]?.name||"";
        return af.localeCompare(bf,"ko")||String(a.plate_number||"").localeCompare(String(b.plate_number||""),"ko");
      });
    const vehicleOptions=sortedVehicles.map(v=>{
      const prefix=isMaster?(facilityMap[v.facility_id]?.name||"시설")+" · ":"";
      return `<option value="${v.id}">${esc(prefix+(v.plate_number||"차량"))}</option>`;
    }).join("");

    const allRows=(await restRequest("vehicle_maintenance?select=*&order=maintenance_date.desc,created_at.desc"))||[];
    const savedFilter=state.maintenanceFilterVehicle||"";
    const filterVehicleId=vehicleMap[savedFilter]?savedFilter:"";
    state.maintenanceFilterVehicle=filterVehicleId;
    const rows=filterVehicleId?allRows.filter(r=>r.vehicle_id===filterVehicleId):allRows;
    const totalCost=rows.reduce((sum,r)=>sum+Number(r.cost||0),0);
    const selectedVehicle=filterVehicleId?vehicleMap[filterVehicleId]:null;
    const scopeLabel=selectedVehicle
      ?(isMaster?(facilityMap[selectedVehicle.facility_id]?.name||"시설")+" · ":"")+(selectedVehicle.plate_number||"차량")
      :"전체 차량";

    const filterOptions=sortedVehicles.map(v=>{
      const prefix=isMaster?(facilityMap[v.facility_id]?.name||"시설")+" · ":"";
      return `<option value="${v.id}" ${v.id===filterVehicleId?"selected":""}>${esc(prefix+(v.plate_number||"차량"))}</option>`;
    }).join("");

    const list=rows.map(r=>{
      const vehicle=vehicleMap[r.vehicle_id]||{};
      const facility=facilityMap[r.facility_id]||{};
      return `<tr>
        ${isMaster?`<td><strong>${esc(facility.name||"시설")}</strong><small>${esc(facility.code||"")}</small></td>`:""}
        <td><strong>${esc(vehicle.plate_number||"차량")}</strong></td>
        <td>${esc(r.maintenance_date||"")}</td>
        <td><strong>${esc(r.item||"")}</strong></td>
        <td class="maintenance-cost">${Number(r.cost||0).toLocaleString()}원</td>
        <td>${esc(r.note||"-")}</td>
        <td><div class="row-actions"><button class="icon-btn" onclick="editMaintenance('${r.id}','${encodeURIComponent(r.item||"").replace(/'/g,"%27")}','${Number(r.cost||0)}','${encodeURIComponent(r.note||"").replace(/'/g,"%27")}')">수정</button><button class="icon-btn danger" onclick="removeMaintenance('${r.id}')">삭제</button></div></td>
      </tr>`;
    }).join("");

    state.maintenanceExportData={rows,allRows,vehicles,facilities,filterVehicleId,isMaster};

    adminFrame(`<section class="card maintenance-card">
      <div class="maintenance-head">
        <div><h2>차량 정비 이력</h2><p>차량별 수리·정비 내역과 비용을 기록하고, 전체 또는 차량별로 조회할 수 있습니다.</p></div>
        <div class="maintenance-total"><span>${filterVehicleId?"선택 차량 정비비":"전체 정비비"}</span><strong>${totalCost.toLocaleString()}원</strong></div>
      </div>

      <div class="maintenance-form">
        <label class="field"><span>차량 번호</span><select id="maintenanceVehicle" class="select"><option value="">차량 선택</option>${vehicleOptions}</select></label>
        <label class="field"><span>정비일</span><input id="maintenanceDate" class="input" type="date" value="${currentKstDate()}"></label>
        <label class="field maintenance-item-field"><span>수리·정비 항목</span><input id="maintenanceItem" class="input" placeholder="예: 엔진오일 교환 / 타이어 교체"></label>
        <label class="field"><span>비용 (원)</span><input id="maintenanceCost" class="input" type="number" min="0" step="1000" inputmode="numeric" placeholder="예: 85000"></label>
        <label class="field maintenance-note-field"><span>비고 <em>선택</em></span><input id="maintenanceNote" class="input" placeholder="예: 정비소 / 다음 점검 시점"></label>
        <button class="btn primary maintenance-add-btn" onclick="addMaintenance()">정비 이력 등록</button>
      </div>

      <div class="maintenance-list-toolbar">
        <div class="maintenance-filter-copy">
          <span>정비내역 조회</span>
          <strong>${esc(scopeLabel)}</strong>
          <small>${rows.length.toLocaleString()}건</small>
        </div>
        <div class="maintenance-filter-actions">
          <select id="maintenanceFilterVehicle" class="select maintenance-filter-select" onchange="setMaintenanceFilter(this.value)">
            <option value="">전체 차량</option>
            ${filterOptions}
          </select>
          <button class="btn dark maintenance-excel-btn" onclick="downloadMaintenanceExcel()">Excel 다운로드</button>
        </div>
      </div>

      <div class="table-scroll">
        <table class="admin-table maintenance-table">
          <thead><tr>${isMaster?"<th>시설</th>":""}<th>차량</th><th>정비일</th><th>수리·정비 항목</th><th>비용</th><th>비고</th><th>관리</th></tr></thead>
          <tbody>${list||`<tr><td colspan="${isMaster?7:6}">해당 조건의 정비 이력이 없습니다.</td></tr>`}</tbody>
        </table>
      </div>
    </section>`);
  }catch(error){
    adminFrame('<div class="empty">'+esc(error.message||"정비 이력을 불러오지 못했습니다.")+'</div>');
  }
}

window.setMaintenanceFilter=function(vehicleId){
  state.maintenanceFilterVehicle=vehicleId||"";
  renderMaintenanceHistory();
}

function buildMaintenanceXlsx(rows,vehicleMap,facilityMap,{isMaster=false,scopeLabel="전체 차량",totalCost=0}={}){
  const headers=isMaster
    ?["시설","차량","정비일","수리·정비 항목","비용(원)","비고"]
    :["차량","정비일","수리·정비 항목","비용(원)","비고"];
  const lastCol=xlsxCol(headers.length);
  const sheetRows=[];
  const add=(n,cells,h)=>sheetRows.push(`<row r="${n}"${h?` ht="${h}" customHeight="1"`:""}>${cells.join("")}</row>`);

  add(1,[xlsxText("A1","차량 정비 이력",1)],32);
  add(2,[xlsxText("A2","조회 범위",2),xlsxText("B2",scopeLabel,3)],24);
  add(3,[xlsxText("A3","정비비 합계",2),xlsxNum("B3",totalCost,3)],24);
  add(4,[],8);
  add(5,headers.map((h,i)=>xlsxText(xlsxCol(i+1)+"5",h,2)),25);

  const bodyCount=Math.max(20,rows.length);
  for(let i=0;i<bodyCount;i++){
    const n=6+i;
    const r=rows[i];
    if(!r){
      add(n,headers.map((_,j)=>xlsxText(xlsxCol(j+1)+n,"",3)),22);
      continue;
    }
    const vehicle=vehicleMap[r.vehicle_id]||{};
    const facility=facilityMap[r.facility_id]||{};
    const values=isMaster
      ?[facility.name||"",vehicle.plate_number||"",r.maintenance_date||"",r.item||"",Number(r.cost||0),r.note||""]
      :[vehicle.plate_number||"",r.maintenance_date||"",r.item||"",Number(r.cost||0),r.note||""];
    const cells=values.map((value,j)=>{
      const ref=xlsxCol(j+1)+n;
      const costIndex=isMaster?4:3;
      return j===costIndex?xlsxNum(ref,value,3):xlsxText(ref,value,3);
    });
    add(n,cells,22);
  }

  let cols="";
  for(let i=1;i<=headers.length;i++){
    const width=isMaster
      ?[24,15,14,28,15,30][i-1]
      :[15,14,28,15,34][i-1];
    cols+=`<col min="${i}" max="${i}" width="${width}" customWidth="1"/>`;
  }

  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${cols}</cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A5:${lastCol}${5+bodyCount}"/><mergeCells count="1"><mergeCell ref="A1:${lastCol}1"/></mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Malgun Gothic"/></font><font><b/><sz val="18"/><name val="Malgun Gothic"/></font><font><b/><sz val="10"/><name val="Malgun Gothic"/></font><font><sz val="10"/><name val="Malgun Gothic"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf fontId="2" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf><xf fontId="2" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

  return zipStore([
    {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`},
    {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="정비이력" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>`},
    {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:"xl/styles.xml",data:styles},
    {name:"xl/worksheets/sheet1.xml",data:sheet}
  ]);
}

window.downloadMaintenanceExcel=function(){
  const data=state.maintenanceExportData;
  if(!data)return toast("정비 이력을 먼저 불러와주세요.");
  const vehicleMap=Object.fromEntries((data.vehicles||[]).map(v=>[v.id,v]));
  const facilityMap=Object.fromEntries((data.facilities||[]).map(f=>[f.id,f]));
  const selectedVehicle=data.filterVehicleId?vehicleMap[data.filterVehicleId]:null;
  const scopeLabel=selectedVehicle
    ?(data.isMaster?(facilityMap[selectedVehicle.facility_id]?.name||"시설")+" · ":"")+(selectedVehicle.plate_number||"차량")
    :"전체 차량";
  const totalCost=(data.rows||[]).reduce((sum,r)=>sum+Number(r.cost||0),0);
  const bytes=buildMaintenanceXlsx(data.rows||[],vehicleMap,facilityMap,{
    isMaster:data.isMaster,
    scopeLabel,
    totalCost
  });
  const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  const safeScope=String(scopeLabel||"전체").replace(/[\\/:*?"<>|]/g,"_");
  a.download="차량정비이력_"+safeScope+".xlsx";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1500);
  toast("정비 이력 Excel을 다운로드했습니다.");
}


window.addMaintenance=async function(){
  const vehicleId=document.getElementById("maintenanceVehicle")?.value;
  const date=document.getElementById("maintenanceDate")?.value;
  const item=document.getElementById("maintenanceItem")?.value.trim();
  const costRaw=document.getElementById("maintenanceCost")?.value;
  const note=document.getElementById("maintenanceNote")?.value.trim();
  if(!vehicleId||!date||!item||costRaw==="")return toast("차량, 정비일, 수리 항목, 비용을 입력해주세요.");
  const cost=Number(costRaw);
  if(!Number.isFinite(cost)||cost<0)return toast("정비 비용을 확인해주세요.");

  let vehicles=state.admin.vehicles||[];
  if(state.admin.profile.role==="superadmin"){
    const o=await getOverview(false);
    vehicles=o.vehicles||[];
  }
  const vehicle=vehicles.find(v=>v.id===vehicleId);
  if(!vehicle)return toast("차량 정보를 찾을 수 없습니다.");

  const button=document.querySelector('[onclick="addMaintenance()"]');
  if(button){button.disabled=true;button.textContent="등록 중...";}
  try{
    await restRequest("vehicle_maintenance",{
      method:"POST",
      headers:{"Prefer":"return=minimal"},
      body:JSON.stringify({
        facility_id:vehicle.facility_id||state.admin.facility.id,
        vehicle_id:vehicleId,
        maintenance_date:date,
        item,
        cost,
        note:note||null,
        created_by:state.admin.profile.id
      })
    });
    toast("정비 이력을 등록했습니다.");
    await renderMaintenanceHistory();
  }catch(error){
    toast(error.message||"정비 이력을 등록하지 못했습니다.");
    if(button){button.disabled=false;button.textContent="정비 이력 등록";}
  }
}

window.editMaintenance=async function(id,encodedItem,currentCost,encodedNote){
  const currentItem=decodeURIComponent(encodedItem||"");
  const currentNote=decodeURIComponent(encodedNote||"");
  const item=prompt("수리·정비 항목을 입력해주세요.",currentItem);
  if(item===null)return;
  const costText=prompt("비용(원)을 입력해주세요.",String(currentCost||0));
  if(costText===null)return;
  const note=prompt("비고를 입력해주세요. 없으면 비워두세요.",currentNote);
  if(note===null)return;
  const cost=Number(costText);
  if(!item.trim()||!Number.isFinite(cost)||cost<0)return toast("수리 항목과 비용을 확인해주세요.");
  try{
    await restRequest("vehicle_maintenance?id="+eq(id),{
      method:"PATCH",
      headers:{"Prefer":"return=minimal"},
      body:JSON.stringify({
        item:item.trim(),
        cost,
        note:note.trim()||null,
        updated_at:new Date().toISOString()
      })
    });
    toast("정비 이력을 수정했습니다.");
    await renderMaintenanceHistory();
  }catch(error){toast(error.message||"정비 이력을 수정하지 못했습니다.")}
}

window.removeMaintenance=async function(id){
  if(!confirm("이 정비 이력을 삭제할까요?"))return;
  try{
    await restRequest("vehicle_maintenance?id="+eq(id),{method:"DELETE"});
    toast("정비 이력을 삭제했습니다.");
    await renderMaintenanceHistory();
  }catch(error){toast(error.message||"정비 이력을 삭제하지 못했습니다.")}
}


function getMemberUploadFacility(isGlobal){
  if(!isGlobal)return {id:state.admin.facility.id,name:state.admin.facility.name,code:state.admin.facility.code};
  const facilityId=document.getElementById("globalFacility")?.value;
  if(!facilityId){toast("직원을 등록할 시설을 먼저 선택해주세요.");return null}
  const facility=state.overview?.facilities?.find(f=>f.id===facilityId);
  return facility?{id:facility.id,name:facility.name,code:facility.code}:{id:facilityId,name:"선택 시설",code:""};
}

function safeFileName(value){
  return String(value||"시설").replace(/[\\/:*?"<>|]/g,"_").trim()||"시설";
}

let xlsxLoaderPromise=null;
function ensureXlsxLibrary(){
  if(window.XLSX)return Promise.resolve(window.XLSX);
  if(xlsxLoaderPromise)return xlsxLoaderPromise;
  const sources=["https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js","https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js"];
  xlsxLoaderPromise=new Promise((resolve,reject)=>{
    let index=0;
    const loadNext=()=>{
      if(index>=sources.length){xlsxLoaderPromise=null;reject(new Error("엑셀 파일 처리 모듈을 불러오지 못했습니다."));return}
      const script=document.createElement("script");
      script.src=sources[index++];
      script.async=true;
      script.onload=()=>{if(window.XLSX)resolve(window.XLSX);else{script.remove();loadNext()}};
      script.onerror=()=>{script.remove();loadNext()};
      document.head.appendChild(script);
    };
    loadNext();
  });
  return xlsxLoaderPromise;
}

window.downloadMemberTemplate=async function(isGlobal=false){
  const facility=getMemberUploadFacility(Boolean(isGlobal));
  if(!facility)return;
  try{
    const XLSX=await ensureXlsxLibrary();
    const rows=[["직원명","입력 안내"],["",facility.name+" 직원 목록"],["","A열에 직원명을 한 행에 한 명씩 입력한 뒤 저장해주세요."]];
    for(let i=0;i<50;i++)rows.push(["",""]);
    const ws=XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"]=[{wch:24},{wch:54}];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,"직원업로드");
    XLSX.writeFile(wb,"직원업로드양식_"+safeFileName(facility.name)+".xlsx");
    toast("직원 업로드 양식을 다운로드했습니다.");
  }catch(error){toast(error.message||"업로드 양식을 만들지 못했습니다.")}
}

async function importMemberWorkbook(file,facility,isGlobal){
  const XLSX=await ensureXlsxLibrary();
  const data=await file.arrayBuffer();
  const wb=XLSX.read(data,{type:"array"});
  const ws=wb.Sheets[wb.SheetNames[0]];
  if(!ws)throw new Error("첫 번째 시트를 읽을 수 없습니다.");
  const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:""});
  if(!rows.length)throw new Error("업로드할 직원명이 없습니다.");
  const header=(rows[0]||[]).map(v=>String(v||"").trim());
  const nameCol=header.findIndex(v=>["직원명","이름","성명"].includes(v));
  if(nameCol<0)throw new Error("양식의 직원명 열을 확인해주세요.");
  const rawNames=rows.slice(1).map(r=>String((r||[])[nameCol]||"").trim()).filter(Boolean);
  if(!rawNames.length)throw new Error("직원명을 입력한 뒤 다시 첨부해주세요.");
  const uniqueNames=[...new Set(rawNames)];
  let existing=[];
  if(isGlobal){
    const o=await getOverview(true);
    existing=(o.members||[]).filter(m=>m.facility_id===facility.id);
  }else{
    existing=state.admin.members||[];
  }
  const existingNames=new Set(existing.map(m=>String(m.name||"").trim()));
  const newNames=uniqueNames.filter(name=>!existingNames.has(name));
  const skipped=rawNames.length-newNames.length;
  if(!newNames.length){toast("새로 등록할 직원이 없습니다. 기존 직원명과 중복되는지 확인해주세요.");return}
  let message=facility.name+"에 직원 "+newNames.length+"명을 등록할까요?";
  if(skipped>0)message+="\n중복 또는 반복 입력 "+skipped+"건은 제외됩니다.";
  if(!confirm(message))return;
  const maxSort=existing.reduce((m,x)=>Math.max(m,Number(x.sort_order)||0),0);
  const payload=newNames.map((name,i)=>({facility_id:facility.id,name,is_active:true,sort_order:maxSort+i+1}));
  await restRequest("facility_members",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
  if(isGlobal){
    state.overview=null;
    await renderGlobalManager("members");
  }else{
    await loadAdminContext();
    await renderAdminHome();
  }
  toast("직원 "+newNames.length+"명을 등록했습니다.");
}

window.uploadMemberTemplate=function(isGlobal=false){
  const facility=getMemberUploadFacility(Boolean(isGlobal));
  if(!facility)return;
  const input=document.createElement("input");
  input.type="file";
  input.accept=".xlsx,.xls";
  input.style.display="none";
  input.onchange=async()=>{
    const file=input.files?.[0];
    if(!file){input.remove();return}
    try{
      toast("엑셀 파일을 확인하고 있습니다.");
      await importMemberWorkbook(file,facility,Boolean(isGlobal));
    }catch(error){toast(error.message||"직원 엑셀을 불러오지 못했습니다.")}
    finally{input.remove()}
  };
  document.body.appendChild(input);
  input.click();
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
  adminFrame(`<section class="card"><h2>관리자 계정 등록</h2><p>시설명과 로그인 정보를 입력하면 해당 시설 전용 관리자 계정과 직원용 접속 주소를 생성합니다.</p><div class="report-grid" style="margin-top:16px"><label class="field" style="margin:0"><span>시설명</span><input id="accountFacilityName" class="input" placeholder="예: 서울○○아동보호전문기관"></label><label class="field" style="margin:0"><span>시설 코드</span><input id="accountFacilityCode" class="input" placeholder="예: SEOUL01"></label><label class="field" style="margin:0"><span>관리자 ID</span><input id="accountLoginId" class="input" placeholder="예: SEOUL01"></label></div><label class="field"><span>초기 비밀번호</span><input id="accountPassword" class="input" type="password" placeholder="초기 비밀번호 입력"></label><button class="btn primary" onclick="prepareFacilityAccount()">관리자 계정 등록</button><div id="accountGuide" class="empty" style="display:none;margin-top:14px"></div></section><section class="card"><div class="admin-list-head"><div><h2>관리자 계정 목록</h2><p>계정을 클릭하면 공유 링크를 확인하고 시설 코드·관리자 ID·비밀번호를 수정할 수 있습니다.</p></div><button class="text-btn" onclick="loadAdminAccounts()">새로고침</button></div><div id="adminAccountList"><div class="empty">관리자 목록을 불러오는 중입니다.</div></div></section>`);
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
      return `<div class="admin-account-row"><button type="button" class="admin-account-summary" onclick="toggleAdminShare('adminShare${i}')"><span><strong>${esc(name)}</strong><small>${esc(code)} · 관리자 ID ${esc(loginId)}</small></span><span class="share-open">계정 관리 ›</span></button><div id="adminShare${i}" class="admin-share-panel" hidden><div class="admin-account-actions"><button class="btn light preview-account-btn" onclick="previewFacility('${encodeURIComponent(code)}')">담당자 화면 미리보기</button><button class="btn light account-password-btn" onclick="openMasterAccountEdit('${encodeURIComponent(item.id)}','${encodeURIComponent(name)}','${encodeURIComponent(code)}','${encodeURIComponent(loginId)}')">계정 정보 수정</button></div><label>관리자 로그인 링크</label><div class="share-line"><input class="input" readonly value="${esc(adminUrl)}"><div class="share-line-actions"><button class="icon-btn" onclick="copyShareLink('${encodeURIComponent(adminUrl)}')">복사</button></div></div><label>직원용 시설 링크</label><div class="share-line"><input class="input" readonly value="${esc(staffUrl)}"><div class="share-line-actions"><button class="icon-btn" onclick="copyShareLink('${encodeURIComponent(staffUrl)}')">복사</button><button class="icon-btn" onclick="downloadStaffQr('${encodeURIComponent(code)}','${encodeURIComponent(name)}')">QR 다운로드</button></div></div></div></div>`;
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
  adminFrame(`<section class="card"><h2>월간 차량운행일지</h2><p>차량과 대상월을 선택한 뒤 웹에서 바로 수정하거나 Excel로 내려받을 수 있습니다.</p><div class="report-grid report-grid-actions" style="margin-top:16px"><label class="field" style="margin:0"><span>대상월</span><input id="reportMonth" class="input" type="month" value="${state.reportEdit?.month||now}"></label><label class="field" style="margin:0"><span>차량</span><select id="reportVehicle" class="select"><option value="">차량 선택</option>${options}</select></label><button class="btn light" onclick="openReportEditor()">웹에서 편집하기</button><button class="btn dark" onclick="downloadReport()">Excel 다운로드</button></div><p class="report-note">웹 편집은 기존 운행기록을 직접 수정합니다. 출발·도착 키로수와 시간 순서는 저장 전에 자동 검증합니다.</p></section>`);
  if(state.reportEdit?.vehicleId){
    const sel=document.getElementById("reportVehicle");
    if(sel)sel.value=state.reportEdit.vehicleId;
  }
}


async function loadReportEditData(month,vehicleId){
  if(state.admin.profile.role==="superadmin"){
    const result=await callAdminApi({action:"report",vehicleId,month});
    return {
      month,
      vehicleId,
      facility:result.facility,
      vehicle:result.vehicle,
      members:result.members||[],
      purposes:result.purposes||[],
      trips:result.trips||[]
    };
  }
  const start=month+"-01T00:00:00+09:00";
  const endDate=new Date(month+"-01T00:00:00+09:00");
  endDate.setMonth(endDate.getMonth()+1);
  const trips=await restRequest("trips?select=*&facility_id="+eq(state.admin.facility.id)+"&vehicle_id="+eq(vehicleId)+"&status=eq.ended&start_at=gte."+encodeURIComponent(start)+"&start_at=lt."+encodeURIComponent(endDate.toISOString())+"&order=admin_sort_order.asc.nullslast,start_at.asc");
  return {
    month,
    vehicleId,
    facility:state.admin.facility,
    vehicle:state.admin.vehicles.find(x=>x.id===vehicleId),
    members:state.admin.members||[],
    purposes:state.admin.purposes||[],
    trips:trips||[]
  };
}
function seoulDateInput(v){
  const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date(v));
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return o.year+"-"+o.month+"-"+o.day;
}
function seoulTimeInput(v){
  if(!v)return "";
  const p=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date(v));
  const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
  return o.hour+":"+o.minute;
}
function toIsoKst(date,time){
  return new Date(date+"T"+time+":00+09:00").toISOString();
}
function memberOptions(members,selected){
  return members.map(m=>`<option value="${m.id}" ${m.id===selected?"selected":""}>${esc(m.name)}</option>`).join("");
}
function passengerPicker(members,selectedIds){
  const selected=new Set(selectedIds||[]);
  const selectedNames=members.filter(m=>selected.has(m.id)).map(m=>m.name);
  const label=selectedNames.length?selectedNames.join(", "):"동행자 없음";
  const choices=members.map(m=>`<label class="passenger-option"><input type="checkbox" value="${m.id}" ${selected.has(m.id)?"checked":""} onchange="updatePassengerPicker(this)"><span>${esc(m.name)}</span></label>`).join("");
  return `<details class="passenger-picker"><summary><span class="passenger-picker-label">${esc(label)}</span></summary><div class="passenger-menu"><div class="passenger-menu-head"><strong>동행자 선택</strong><button type="button" onclick="clearPassengerPicker(this)">선택 해제</button></div><div class="passenger-options">${choices||'<div class="field-help">등록된 직원이 없습니다.</div>'}</div></div></details>`;
}
function purposeOptions(purposes,selected){
  return purposes.map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("");
}
function reportRowHtml(r,i,data){
  const isNew=String(r.id||"").startsWith("new-");
  const dateValue=r.start_at?seoulDateInput(r.start_at):(r.date||"");
  const startValue=r.start_at?seoulTimeInput(r.start_at):(r.startTime||"");
  const endValue=r.end_at?seoulTimeInput(r.end_at):(r.endTime||"");
  const sortOrder=Number(r.admin_sort_order)||i+1;
  return `<tr class="edit-trip-row${isNew?" changed new-row":""}" draggable="true" data-trip-id="${r.id}" data-new="${isNew?"1":"0"}" data-index="${i}" data-sort-order="${sortOrder}" ondragstart="reportDragStart(event)" ondragover="reportDragOver(event)" ondrop="reportDrop(event)" ondragend="reportDragEnd(event)">
    <td class="row-drag-cell"><span class="drag-handle" title="드래그해서 순서 이동" aria-label="드래그해서 순서 이동">⋮⋮</span></td>
    <td class="row-select-cell"><input class="row-select-check" type="checkbox" aria-label="행 선택" onchange="updateReportSelection()"></td>
    <td><input class="cell-input edit-date" type="date" value="${dateValue}" onchange="markReportRowChanged(this)"></td>
    <td><select class="cell-select edit-driver" onchange="markReportRowChanged(this)"><option value="">선택</option>${memberOptions(data.members,r.driver_id)}</select></td>
    <td class="passenger-cell">${passengerPicker(data.members,r.passenger_ids||[])}</td>
    <td><select class="cell-select edit-purpose" onchange="markReportRowChanged(this)"><option value="">선택</option>${purposeOptions(data.purposes,r.purpose_id)}</select></td>
    <td><input class="cell-input edit-destination" value="${esc(r.destination||"")}" onchange="markReportRowChanged(this)"></td>
    <td><input class="cell-input edit-start-time" type="time" value="${startValue}" onchange="markReportRowChanged(this)"></td>
    <td><input class="cell-input edit-end-time" type="time" value="${endValue}" onchange="markReportRowChanged(this)"></td>
    <td><input class="cell-input number-input edit-start-km" type="number" step="0.1" value="${r.start_odometer??""}" oninput="markReportRowChanged(this);updateReportDistance(this)"></td>
    <td><input class="cell-input number-input edit-end-km" type="number" step="0.1" value="${r.end_odometer??""}" oninput="markReportRowChanged(this);updateReportDistance(this)"></td>
    <td class="distance-cell">${r.distance!=null?Number(r.distance).toLocaleString():"-"}</td>
    <td><input class="cell-input number-input edit-highpass-cost" type="number" min="0" step="100" value="${r.highpass_cost??""}" placeholder="-" oninput="markReportRowChanged(this)"></td>
    <td><input class="cell-input number-input edit-fuel-cost" type="number" min="0" step="100" value="${r.fuel_cost??""}" placeholder="-" oninput="markReportRowChanged(this)"></td>
    <td><input class="cell-input edit-note" value="${esc(r.note||"")}" onchange="markReportRowChanged(this)"></td>
  </tr>`;
}

function reportEditorMarkup(data,{saved=false}={}){
  const rows=data.trips.map((r,i)=>reportRowHtml(r,i,data)).join("");
  return `<section class="card report-editor-card">
    <div class="editor-head"><div><button class="back-link" onclick="renderReport()">← 월간 운행일지</button><h2>웹에서 편집하기</h2><p>${esc(data.facility?.name||"")} · ${esc(data.vehicle?.plate_number||"")} · ${esc(data.month||state.reportEdit?.month||"")}</p></div><div class="editor-actions"><button class="btn light" onclick="renderReport()">닫기</button><button id="saveReportEditsButton" class="btn primary" onclick="saveReportEdits()">변경사항 저장</button></div></div>
    <div class="edit-guide ${saved?"saved":""}"><strong>${saved?"저장 완료":"수정 안내"}</strong><span>${saved?"최신 데이터로 다시 불러왔습니다.":"왼쪽 이동 손잡이를 드래그해 순서를 바꿀 수 있습니다. 체크박스로 행을 선택해 삭제하거나 ‘행 추가’로 누락된 기록을 입력할 수 있습니다."}</span></div>
    <div class="editor-row-tools">
      <div class="editor-row-tools-left">
        <button type="button" class="icon-btn add-row-btn" onclick="addReportRow()">＋ 행 추가</button>
        <button id="deleteSelectedRowsButton" type="button" class="icon-btn danger" onclick="deleteSelectedReportRows()" disabled>선택 삭제</button>
      </div>
      <span id="selectionCountLabel">선택된 행 없음</span>
    </div>
    <div class="table-scroll report-edit-scroll"><table class="admin-table report-edit-table"><thead><tr><th class="row-drag-head"></th><th class="row-select-head"><input id="selectAllReportRows" type="checkbox" aria-label="전체 선택" onchange="toggleAllReportRows(this)"></th><th>날짜</th><th>운전자</th><th>동행자</th><th>용무</th><th>행선지</th><th>출발</th><th>도착</th><th>출발km</th><th>도착km</th><th>운행거리</th><th>하이패스</th><th>주유</th><th>비고</th></tr></thead><tbody id="reportEditBody">${rows||'<tr class="report-empty-row"><td colspan="15">수정할 운행기록이 없습니다. ‘행 추가’를 눌러 새 기록을 입력할 수 있습니다.</td></tr>'}</tbody></table></div>
    <div class="editor-bottom"><div class="editor-bottom-status"><span id="editCountLabel">변경된 기록 없음</span><span class="editor-bottom-divider">·</span><span id="bottomSelectionCount">선택된 행 없음</span></div><div class="editor-bottom-actions"><button type="button" class="btn light" onclick="addReportRow()">＋ 행 추가</button><button class="btn primary" onclick="saveReportEdits()">변경사항 저장</button></div></div>
  </section>`;
}

window.openReportEditor=async function(){
  const month=document.getElementById("reportMonth")?.value;
  const vehicleId=document.getElementById("reportVehicle")?.value;
  if(!month||!vehicleId)return toast("대상월과 차량을 선택해주세요.");
  adminFrame('<div class="empty">운행기록을 불러오는 중입니다.</div>');
  try{
    const data=await loadReportEditData(month,vehicleId);
    state.reportEdit={...data,month,vehicleId,original:Object.fromEntries(data.trips.map(x=>[x.id,JSON.stringify(x)]))};
    adminFrame(reportEditorMarkup(state.reportEdit));
  }catch(error){
    adminFrame('<div class="empty">'+esc(error.message||"운행기록을 불러오지 못했습니다.")+'</div>');
  }
}

window.updatePassengerPicker=function(input){
  const picker=input.closest(".passenger-picker");
  const row=input.closest(".edit-trip-row");
  if(!picker||!row)return;
  const names=[...picker.querySelectorAll('input[type="checkbox"]:checked')].map(x=>x.nextElementSibling?.textContent||"").filter(Boolean);
  const label=picker.querySelector(".passenger-picker-label");
  if(label)label.textContent=names.length?names.join(", "):"동행자 없음";
  markReportRowChanged(input);
}
window.clearPassengerPicker=function(button){
  const picker=button.closest(".passenger-picker");
  if(!picker)return;
  picker.querySelectorAll('input[type="checkbox"]').forEach(x=>x.checked=false);
  const label=picker.querySelector(".passenger-picker-label");
  if(label)label.textContent="동행자 없음";
  const row=picker.closest(".edit-trip-row");
  if(row)row.classList.add("changed");
  updateReportEditStatus();
}

function updateReportEditStatus(){
  const changed=document.querySelectorAll(".edit-trip-row.changed").length;
  const selected=document.querySelectorAll(".row-select-check:checked").length;
  const editLabel=document.getElementById("editCountLabel");
  const selectionLabel=document.getElementById("selectionCountLabel");
  const bottomSelection=document.getElementById("bottomSelectionCount");
  const deleteBtn=document.getElementById("deleteSelectedRowsButton");
  if(editLabel)editLabel.textContent=changed?changed+"건 변경됨":"변경된 기록 없음";
  const selectedText=selected?selected+"건 선택됨":"선택된 행 없음";
  if(selectionLabel)selectionLabel.textContent=selectedText;
  if(bottomSelection)bottomSelection.textContent=selectedText;
  if(deleteBtn)deleteBtn.disabled=selected===0;
  const all=document.getElementById("selectAllReportRows");
  const checks=[...document.querySelectorAll(".row-select-check")];
  if(all){
    all.checked=checks.length>0&&checks.every(x=>x.checked);
    all.indeterminate=selected>0&&selected<checks.length;
  }
}

window.markReportRowChanged=function(el){
  const row=el.closest(".edit-trip-row");
  if(row)row.classList.add("changed");
  updateReportEditStatus();
}
window.updateReportSelection=function(){updateReportEditStatus()}
window.toggleAllReportRows=function(master){
  document.querySelectorAll(".row-select-check").forEach(x=>x.checked=master.checked);
  updateReportEditStatus();
}

let draggedReportRow=null;
let draggedReportOriginIndex=-1;
let draggedReportFinalized=false;
window.reportDragStart=function(event){
  const row=event.currentTarget;
  if(event.target?.closest("input,select,button,details,summary,label")){
    event.preventDefault();
    return;
  }
  draggedReportRow=row;
  draggedReportOriginIndex=[...row.parentNode.querySelectorAll(".edit-trip-row")].indexOf(row);
  draggedReportFinalized=false;
  row.classList.add("dragging");
  if(event.dataTransfer){
    event.dataTransfer.effectAllowed="move";
    event.dataTransfer.setData("text/plain",row.dataset.tripId||"");
  }
}
window.reportDragOver=function(event){
  if(!draggedReportRow)return;
  event.preventDefault();
  const target=event.currentTarget;
  if(target===draggedReportRow)return;
  const rect=target.getBoundingClientRect();
  const after=event.clientY>rect.top+rect.height/2;
  target.parentNode.insertBefore(draggedReportRow,after?target.nextSibling:target);
}
window.reportDrop=function(event){
  if(!draggedReportRow)return;
  event.preventDefault();
  markReportOrderChanged(draggedReportRow,draggedReportOriginIndex);
  draggedReportFinalized=true;
}
window.reportDragEnd=function(){
  if(draggedReportRow&&!draggedReportFinalized){
    markReportOrderChanged(draggedReportRow,draggedReportOriginIndex);
  }
  if(draggedReportRow)draggedReportRow.classList.remove("dragging");
  draggedReportRow=null;
  draggedReportOriginIndex=-1;
  draggedReportFinalized=false;
}
function markReportOrderChanged(movedRow=null,originIndex=-1){
  const rows=[...document.querySelectorAll(".edit-trip-row")];
  rows.forEach((row,index)=>{
    row.dataset.sortOrder=String(index+1);
  });
  if(movedRow&&originIndex>=0){
    const currentIndex=rows.indexOf(movedRow);
    if(currentIndex!==originIndex)movedRow.classList.add("changed","reordered");
  }
  updateReportEditStatus();
}

window.updateReportDistance=function(el){
  const row=el.closest(".edit-trip-row");
  if(!row)return;
  const startRaw=row.querySelector(".edit-start-km")?.value;
  const endRaw=row.querySelector(".edit-end-km")?.value;
  const s=Number(startRaw),e=Number(endRaw);
  const cell=row.querySelector(".distance-cell");
  if(cell)cell.textContent=startRaw!==""&&endRaw!==""&&Number.isFinite(s)&&Number.isFinite(e)&&e>=s?(e-s).toLocaleString():"-";
}

window.addReportRow=function(){
  if(!state.reportEdit)return;
  const body=document.getElementById("reportEditBody");
  if(!body)return;
  body.querySelector(".report-empty-row")?.remove();
  const existing=[...document.querySelectorAll(".edit-trip-row")];
  const last=existing[existing.length-1];
  const month=state.reportEdit.month;
  const fallbackDate=month+"-01";
  const date=last?.querySelector(".edit-date")?.value||fallbackDate;
  const previousEnd=last?.querySelector(".edit-end-km")?.value||"";
  const temp={
    id:"new-"+Date.now()+"-"+Math.random().toString(36).slice(2,7),
    date,
    startTime:"",
    endTime:"",
    driver_id:"",
    passenger_ids:[],
    purpose_id:"",
    destination:"",
    start_odometer:previousEnd,
    end_odometer:"",
    distance:null,
    highpass_cost:null,
    fuel_cost:null,
    note:"",
    admin_sort_order:existing.length+1
  };
  const wrapper=document.createElement("tbody");
  wrapper.innerHTML=reportRowHtml(temp,existing.length,state.reportEdit);
  const row=wrapper.firstElementChild;
  body.appendChild(row);
  row.scrollIntoView({behavior:"smooth",block:"nearest"});
  row.querySelector(".edit-driver")?.focus();
  markReportOrderChanged();
}

window.deleteSelectedReportRows=async function(){
  const rows=[...document.querySelectorAll(".edit-trip-row")].filter(row=>row.querySelector(".row-select-check")?.checked);
  if(!rows.length)return toast("삭제할 행을 선택해주세요.");
  const existingRows=rows.filter(row=>row.dataset.new!=="1");
  const message=existingRows.length
    ? "선택한 "+rows.length+"건을 삭제할까요? 저장된 운행기록 "+existingRows.length+"건은 즉시 삭제됩니다."
    : "선택한 "+rows.length+"개의 새 행을 삭제할까요?";
  if(!confirm(message))return;
  try{
    for(const row of existingRows){
      await restRequest("trips?id="+eq(row.dataset.tripId),{method:"DELETE"});
    }
    rows.forEach(row=>row.remove());
    toast(existingRows.length?"선택한 운행기록을 삭제했습니다.":"추가한 행을 삭제했습니다.");
    if(existingRows.length){
      await openReportEditorFromState();
    }else{
      markReportOrderChanged();
      const body=document.getElementById("reportEditBody");
      if(body&&!body.querySelector(".edit-trip-row"))body.innerHTML='<tr class="report-empty-row"><td colspan="15">수정할 운행기록이 없습니다. ‘행 추가’를 눌러 새 기록을 입력할 수 있습니다.</td></tr>';
    }
  }catch(error){toast(error.message||"선택한 기록을 삭제하지 못했습니다.")}
}

function collectReportRows(){
  return [...document.querySelectorAll(".edit-trip-row")].map((row,index)=>{
    const selectedPassengers=[...row.querySelectorAll('.passenger-picker input[type="checkbox"]:checked')].map(o=>o.value);
    const date=row.querySelector(".edit-date").value;
    const startTime=row.querySelector(".edit-start-time").value;
    const endTime=row.querySelector(".edit-end-time").value;
    const startRaw=row.querySelector(".edit-start-km").value;
    const endRaw=row.querySelector(".edit-end-km").value;
    const startKm=startRaw===""?NaN:Number(startRaw);
    const endKm=endRaw===""?NaN:Number(endRaw);
    const highpassRaw=row.querySelector(".edit-highpass-cost")?.value??"";
    const fuelRaw=row.querySelector(".edit-fuel-cost")?.value??"";
    const highpassCost=highpassRaw===""?null:Number(highpassRaw);
    const fuelCost=fuelRaw===""?null:Number(fuelRaw);
    return {
      id:row.dataset.tripId,
      isNew:row.dataset.new==="1",
      changed:row.classList.contains("changed"),
      sortOrder:index+1,
      date,startTime,endTime,startKm,endKm,highpassCost,fuelCost,
      driver_id:row.querySelector(".edit-driver").value,
      passenger_ids:selectedPassengers,
      purpose_id:row.querySelector(".edit-purpose").value,
      destination:row.querySelector(".edit-destination").value.trim(),
      note:row.querySelector(".edit-note").value.trim(),
      start_at:date&&startTime?toIsoKst(date,startTime):null,
      end_at:date&&endTime?toIsoKst(date,endTime):null
    };
  });
}
function validateReportRows(rows){
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    if(!r.date||!r.startTime||!r.endTime||!r.driver_id||!r.purpose_id||!r.destination)return "필수값이 비어 있는 행이 있습니다.";
    if(!Number.isFinite(r.startKm)||!Number.isFinite(r.endKm))return "키로수는 숫자로 입력해주세요.";
    if(r.endKm<r.startKm)return "도착 키로수는 출발 키로수보다 작을 수 없습니다.";
    if(r.highpassCost!==null&&(!Number.isFinite(r.highpassCost)||r.highpassCost<0))return "하이패스 비용은 0원 이상의 숫자로 입력해주세요.";
    if(r.fuelCost!==null&&(!Number.isFinite(r.fuelCost)||r.fuelCost<0))return "주유 비용은 0원 이상의 숫자로 입력해주세요.";
    if(new Date(r.end_at)<new Date(r.start_at))return "도착시간은 출발시간보다 빠를 수 없습니다.";
  }
  const chronological=[...rows].sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
  for(let i=1;i<chronological.length;i++){
    const prev=chronological[i-1],cur=chronological[i];
    if(cur.startKm<prev.endKm)return `${cur.date} 기록의 출발 키로수가 이전 운행의 도착 키로수보다 작습니다.`;
  }
  return "";
}
window.saveReportEdits=async function(){
  const rows=collectReportRows();
  const changed=rows.filter(r=>r.changed||r.isNew);
  if(!changed.length)return toast("변경된 기록이 없습니다.");
  const error=validateReportRows(rows);
  if(error)return toast(error);
  const buttons=[...document.querySelectorAll('[onclick="saveReportEdits()"]')];
  buttons.forEach(button=>{button.disabled=true;button.dataset.label=button.textContent;button.textContent="저장 중...";});
  try{
    const orderWasChanged=Boolean(document.querySelector(".edit-trip-row.reordered"));
    const targets=orderWasChanged?rows:changed;
    for(const r of targets){
      const payload={
        driver_id:r.driver_id,
        passenger_ids:r.passenger_ids,
        purpose_id:r.purpose_id,
        destination:r.destination,
        start_at:r.start_at,
        end_at:r.end_at,
        start_odometer:r.startKm,
        end_odometer:r.endKm,
        distance:r.endKm-r.startKm,
        highpass_cost:r.highpassCost,
        fuel_cost:r.fuelCost,
        status:"ended",
        note:r.note||null,
        admin_edited_at:new Date().toISOString(),
        admin_edited_by:state.admin.profile.id,
        admin_sort_order:r.sortOrder
      };
      if(r.isNew){
        payload.facility_id=state.reportEdit.facility.id;
        payload.vehicle_id=state.reportEdit.vehicle.id;
        await restRequest("trips",{method:"POST",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
      }else{
        await restRequest("trips?id="+eq(r.id),{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify(payload)});
      }
    }
    toast("변경사항을 저장했습니다.");
    await openReportEditorFromState();
  }catch(error){
    toast(error.message||"변경사항을 저장하지 못했습니다.");
    buttons.forEach(button=>{button.disabled=false;button.textContent=button.dataset.label||"변경사항 저장";});
  }
}
async function openReportEditorFromState(){
  const month=state.reportEdit?.month,vehicleId=state.reportEdit?.vehicleId;
  if(!month||!vehicleId)return renderReport();
  adminFrame('<div class="empty">저장된 운행기록을 다시 불러오는 중입니다.</div>');
  try{
    const data=await loadReportEditData(month,vehicleId);
    state.reportEdit={...data,month,vehicleId,original:Object.fromEntries(data.trips.map(x=>[x.id,JSON.stringify(x)]))};
    adminFrame(reportEditorMarkup(state.reportEdit,{saved:true}));
  }catch(error){adminFrame('<div class="empty">'+esc(error.message||"운행기록을 다시 불러오지 못했습니다.")+'</div>')}
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
function xlsxCol(n){
  let s="";
  while(n>0){n--;s=String.fromCharCode(65+(n%26))+s;n=Math.floor(n/26);}
  return s;
}
function buildMonthlyXlsx(month,rows,vehicle,members,purposes,facilityName="",options={}){
  const includeHighpass=options.includeHighpass===true;
  const includeFuel=options.includeFuel===true;
  const sheetRows=[];
  const monthLabel=String(Number(String(month||"").split("-")[1]||0)||"").trim();
  const headers=["날짜","운전자","동행자","용무","행선지","출발시간","도착시간","출발km","도착km","운행거리"];
  if(includeHighpass)headers.push("하이패스(원)");
  if(includeFuel)headers.push("주유(원)");
  const lastCol=xlsxCol(headers.length);
  const approvalStart=Math.max(8,headers.length-2);
  const approvalMid=approvalStart+1;
  const approvalEnd=approvalStart+2;
  const approvalStartCol=xlsxCol(approvalStart);
  const approvalMidCol=xlsxCol(approvalMid);
  const approvalEndCol=xlsxCol(approvalEnd);
  const add=(n,cells,h)=>sheetRows.push(`<row r="${n}"${h?` ht="${h}" customHeight="1"`:""}>${cells.join("")}</row>`);

  add(1,[xlsxText(approvalStartCol+"1","결재",7),xlsxText(approvalMidCol+"1","담당",2),xlsxText(approvalEndCol+"1","팀장",2)],28);
  add(2,[xlsxText(approvalStartCol+"2","",7),xlsxText(approvalMidCol+"2","",3),xlsxText(approvalEndCol+"2","",3)],34);
  add(3,[],8);
  add(4,[xlsxText("A4",(monthLabel?monthLabel+"월 ":"")+"차량운행일지",1)],30);
  add(5,[],8);
  add(6,[xlsxText("A6","차량",2),xlsxText("B6",vehicle?.plate_number||"",3),xlsxText("C6","",3),xlsxText("D6","시설",2),xlsxText("E6",facilityName,3),xlsxText("F6","",3),xlsxText("G6","",3)],23);
  add(7,[xlsxText("A7","대상월",2),xlsxText("B7",month,3)],23);
  add(8,headers.map((x,i)=>xlsxText(xlsxCol(i+1)+"8",x,2)),25);

  const bodyCount=Math.max(30,rows.length);
  for(let i=0;i<bodyCount;i++){
    const n=9+i,r=rows[i];
    const cells=[
      xlsxText("A"+n,r?seoulDateKey(r.start_at):"",3),
      xlsxText("B"+n,r?members[r.driver_id]||"":"",3),
      xlsxText("C"+n,r?(r.passenger_ids||[]).map(id=>members[id]).filter(Boolean).join(", "):"",3),
      xlsxText("D"+n,r?purposes[r.purpose_id]||"":"",3),
      xlsxText("E"+n,r?r.destination||"":"",3),
      xlsxText("F"+n,r?seoulTime(r.start_at):"",3),
      xlsxText("G"+n,r?seoulTime(r.end_at):"",3),
      r?xlsxNum("H"+n,r.start_odometer,3):xlsxText("H"+n,"",3),
      r?xlsxNum("I"+n,r.end_odometer,3):xlsxText("I"+n,"",3),
      r?xlsxNum("J"+n,r.distance,3):xlsxText("J"+n,"",3)
    ];
    let col=11;
    if(includeHighpass){
      cells.push(r?xlsxNum(xlsxCol(col)+n,r.highpass_cost,3):xlsxText(xlsxCol(col)+n,"",3));
      col++;
    }
    if(includeFuel){
      cells.push(r?xlsxNum(xlsxCol(col)+n,r.fuel_cost,3):xlsxText(xlsxCol(col)+n,"",3));
    }
    add(n,cells,22);
  }

  let cols='<col min="1" max="1" width="14" customWidth="1"/><col min="2" max="3" width="14" customWidth="1"/><col min="4" max="4" width="24" customWidth="1"/><col min="5" max="5" width="20" customWidth="1"/><col min="6" max="7" width="12" customWidth="1"/><col min="8" max="10" width="13" customWidth="1"/>';
  if(includeHighpass)cols+='<col min="11" max="11" width="13" customWidth="1"/>';
  if(includeFuel){
    const fuelCol=includeHighpass?12:11;
    cols+=`<col min="${fuelCol}" max="${fuelCol}" width="13" customWidth="1"/>`;
  }

  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" showGridLines="0"/></sheetViews><cols>${cols}</cols><sheetData>${sheetRows.join("")}</sheetData><autoFilter ref="A8:${lastCol}${8+bodyCount}"/><mergeCells count="4"><mergeCell ref="A4:${lastCol}4"/><mergeCell ref="${approvalStartCol}1:${approvalStartCol}2"/><mergeCell ref="B6:C6"/><mergeCell ref="E6:G6"/></mergeCells><pageMargins left="0.2" right="0.2" top="0.35" bottom="0.35" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
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
window.downloadReport=function(){
  const month=document.getElementById("reportMonth")?.value;
  const vehicleId=document.getElementById("reportVehicle")?.value;
  if(!month||!vehicleId)return toast("대상월과 차량을 선택해주세요.");
  showAdminModal(`<div class="admin-modal-head"><div><span class="modal-kicker">EXCEL 다운로드</span><h2>추가 내역을 선택하세요</h2><p>기본 운행일지 양식은 그대로 유지됩니다. 필요한 비용 항목만 운행거리 오른쪽에 추가합니다.</p></div><button class="modal-close" onclick="closeAdminModal()" aria-label="닫기">×</button></div>
    <div class="report-export-options">
      <label class="report-export-option"><input id="exportHighpass" type="checkbox"><span><strong>하이패스</strong><small>하이패스 비용 열을 추가합니다.</small></span></label>
      <label class="report-export-option"><input id="exportFuel" type="checkbox"><span><strong>주유</strong><small>주유 비용 열을 추가합니다.</small></span></label>
    </div>
    <div class="modal-note">아무 항목도 선택하지 않으면 기존 10개 열의 기본 운행일지로 다운로드됩니다.</div>
    <div class="modal-actions"><button class="btn light" onclick="closeAdminModal()">취소</button><button class="btn primary" onclick="downloadReportWithOptions()">Excel 다운로드</button></div>`);
}
window.downloadReportWithOptions=async function(){
  const month=document.getElementById("reportMonth")?.value;
  const vehicleId=document.getElementById("reportVehicle")?.value;
  const includeHighpass=document.getElementById("exportHighpass")?.checked===true;
  const includeFuel=document.getElementById("exportFuel")?.checked===true;
  if(!month||!vehicleId)return toast("대상월과 차량을 선택해주세요.");
  const button=document.querySelector('[onclick="downloadReportWithOptions()"]');
  if(button){button.disabled=true;button.textContent="파일 생성 중...";}
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
      rows=await restRequest("trips?select=*&facility_id="+eq(state.admin.facility.id)+"&vehicle_id="+eq(vehicleId)+"&status=eq.ended&start_at=gte."+encodeURIComponent(start)+"&start_at=lt."+encodeURIComponent(endDate.toISOString())+"&order=admin_sort_order.asc.nullslast,start_at.asc");
      members=Object.fromEntries(state.admin.members.map(x=>[x.id,x.name]));
      purposes=Object.fromEntries(state.admin.purposes.map(x=>[x.id,x.name]));
      vehicle=state.admin.vehicles.find(x=>x.id===vehicleId);
      facilityName=state.admin.facility.name;
    }

    rows=[...(rows||[])].sort((a,b)=>{
      const aStart=new Date(a.start_at||0).getTime();
      const bStart=new Date(b.start_at||0).getTime();
      if(aStart!==bStart)return aStart-bStart;
      return String(a.id||"").localeCompare(String(b.id||""));
    });
    const bytes=buildMonthlyXlsx(month,rows,vehicle,members,purposes,facilityName,{includeHighpass,includeFuel});
    const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`차량운행일지_${vehicle?.plate_number||"차량"}_${month}.xlsx`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    closeAdminModal();
    toast("수정 가능한 월간 Excel 운행일지를 다운로드했습니다.");
  }catch(error){
    toast(error.message||"운행일지를 만들지 못했습니다.");
    if(button){button.disabled=false;button.textContent="Excel 다운로드";}
  }
};

(async()=>{
  try{
    if(qs.get("admin")==="1") await renderAdmin();
    else if(state.facilityCode) await loadPublic();
    else await renderAdmin();
  }catch(error){
    console.error("app start failed",error);
    app.innerHTML='<main class="login-wrap"><section class="login-card"><div class="login-brand">차량 운행일지 관리</div><h1>화면을 불러오지 못했습니다.</h1><p>잠시 후 다시 시도해주세요.</p><button class="btn light" onclick="location.reload()">새로고침</button></section></main>';
  }
})();
