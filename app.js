const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const params=new URLSearchParams(location.search);
const queryApi=params.get("api")||"";
if(queryApi)localStorage.setItem("vehicleApi",queryApi);
const state={api:queryApi||localStorage.getItem("vehicleApi")||"",facility:"",vehicles:[],users:[],purposes:[],active:{}};
const demo={facility:"샘플 아동보호전문기관",vehicles:["12가3456","34나7890"],users:["김상담","이주임","박팀장"],purposes:["가정방문","회의·교육","행정업무","물품수령"],active:{}};

const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

async function api(action,payload={}){
  if(!state.api)return demoApi(action,payload);
  const r=await fetch(state.api,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,...payload})});
  const j=await r.json();
  if(!j.ok)throw new Error(j.error||"API 오류");
  return j.data;
}

function demoApi(action,p){
  if(action==="bootstrap")return structuredClone(demo);
  if(action==="startTrip"){
    if(demo.active[p.vehicle])throw Error("이미 운행 중인 차량입니다.");
    demo.active[p.vehicle]={...p,startTime:new Date().toLocaleString("ko-KR")};
    return demo.active[p.vehicle];
  }
  if(action==="endTrip"){delete demo.active[p.vehicle];return true}
  if(action==="getMonthlyReport"){return {facility:demo.facility,records:[]}}
  if(action==="saveSettings"){Object.assign(demo,p.settings);return true}
}

function fill(id,arr,placeholder){
  const el=$(id);
  el.innerHTML='<option value="">'+placeholder+'</option>'+arr.map(x=>'<option>'+esc(x)+'</option>').join("");
}

async function load(){
  try{
    const d=await api("bootstrap");
    Object.assign(state,d);
    $("#facilityName").textContent=d.facility||"시설명 미설정";
    $("#apiState").textContent=state.api?"CONNECTED":"DEMO";
    fill("#vehicle",d.vehicles||[],"차량 선택");
    fill("#driver",d.users||[],"운행자 선택");
    fill("#passenger",d.users||[],"동승자 선택");
    fill("#purpose",d.purposes||[],"운행목적 선택");
    fill("#reportVehicle",d.vehicles||[],"차량 선택");
    if(!$("#reportMonth").value)$("#reportMonth").value=new Date().toISOString().slice(0,7);
    renderAdmin();
    syncVehicle();
  }catch(e){alert(e.message)}
}

function syncVehicle(){
  const v=$("#vehicle").value,a=state.active?.[v];
  $("#startCard").classList.toggle("hidden",!!a);
  $("#endCard").classList.toggle("hidden",!a);
  if(!v){
    $("#vehicleStatus").textContent="차량을 선택해 주세요.";
    $("#vehicleStatus").className="status";
    return;
  }
  if(a){
    $("#vehicleStatus").textContent=(a.driver||"누군가")+" 님이 운전 중입니다.";
    $("#vehicleStatus").className="status live";
    $("#activeSummary").textContent=[v,a.driver,a.destination,a.startTime].filter(Boolean).join(" · ");
    $("#endKm").value=a.startKm||"";
  }else{
    $("#vehicleStatus").textContent="현재 운행 가능한 차량입니다.";
    $("#vehicleStatus").className="status";
  }
}

function selectedPassengers(){return [...$("#passenger").selectedOptions].map(o=>o.value).filter(Boolean)}

$("#vehicle").addEventListener("change",syncVehicle);

$("#startBtn").onclick=async()=>{
  const p={vehicle:$("#vehicle").value,driver:$("#driver").value,passengers:selectedPassengers(),purpose:$("#purpose").value,destination:$("#destination").value.trim(),startKm:Number($("#startKm").value)};
  if(!p.vehicle||!p.driver||!p.purpose||!p.destination||!p.startKm)return alert("필수 항목을 모두 입력해 주세요.");
  try{await api("startTrip",p);await load()}catch(e){alert(e.message)}
};

$("#endBtn").onclick=async()=>{
  const vehicle=$("#vehicle").value,endKm=Number($("#endKm").value);
  if(!endKm)return alert("도착 키로수를 입력해 주세요.");
  try{await api("endTrip",{vehicle,endKm});await load()}catch(e){alert(e.message)}
};

function switchTab(admin){
  $("#userView").classList.toggle("hidden",admin);
  $("#adminView").classList.toggle("hidden",!admin);
  $("#userTab").classList.toggle("activeTab",!admin);
  $("#adminTab").classList.toggle("activeTab",admin);
}
$("#userTab").onclick=()=>switchTab(false);
$("#adminTab").onclick=()=>switchTab(true);

function editor(target,arr){
  $(target).innerHTML=arr.map((x,i)=>'<div class="row"><input value="'+esc(x)+'" data-i="'+i+'"><button class="mini danger" data-del="'+i+'">삭제</button></div>').join("");
  $(target).onclick=e=>{if(e.target.dataset.del!==undefined){arr.splice(Number(e.target.dataset.del),1);renderAdmin()}};
  $(target).oninput=e=>{if(e.target.dataset.i!==undefined)arr[Number(e.target.dataset.i)]=e.target.value};
}

function renderAdmin(){
  editor("#vehicleAdmin",state.vehicles);
  editor("#userAdmin",state.users);
  editor("#purposeAdmin",state.purposes);
  $("#facilityNameAdmin").value=state.facility||"";
  $("#apiUrl").value=state.api;
}

$$("[data-add]").forEach(b=>b.onclick=()=>{state[b.dataset.add].push("");renderAdmin()});

$("#connectBtn").onclick=async()=>{
  state.api=$("#apiUrl").value.trim();
  localStorage.setItem("vehicleApi",state.api);
  await load();
};

$("#copyUserLink").onclick=async()=>{
  const api=$("#apiUrl").value.trim();
  if(!api)return alert("먼저 API 주소를 입력해 주세요.");
  const u=new URL(location.href);
  u.search="";
  u.searchParams.set("api",api);
  try{
    await navigator.clipboard.writeText(u.toString());
    alert("사용자용 링크를 복사했습니다. 이 링크로 QR을 만들면 됩니다.");
  }catch(e){
    prompt("아래 링크를 복사해 QR로 배포하세요.",u.toString());
  }
};

function xlsEscape(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}

function timeOnly(v){if(!v)return "";const d=new Date(v);return isNaN(d)?String(v):d.toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit",hour12:false})}
function dateOnly(v){if(!v)return "";const d=new Date(v);return isNaN(d)?String(v).slice(0,10):d.toLocaleDateString("ko-KR")}

function downloadMonthlyXls(data,vehicle,month){
  const rows=(data.records||[]).map(r=>`<tr><td>${xlsEscape(dateOnly(r["출발시각"]||r["운행일자"]))}</td><td>${xlsEscape(r["운행자"])}</td><td>${xlsEscape(r["동승자"])}</td><td>${xlsEscape(r["운행목적"])}</td><td>${xlsEscape(r["행선지"])}</td><td>${xlsEscape(timeOnly(r["출발시각"]))}</td><td>${xlsEscape(timeOnly(r["종료시각"]))}</td><td>${xlsEscape(r["운행거리"])}</td><td>${xlsEscape(r["비고"]||"")}</td></tr>`).join("");
  const total=(data.records||[]).reduce((s,r)=>s+Number(r["운행거리"]||0),0);
  const first=(data.records||[]).find(r=>r["출발키로수"]!==""&&r["출발키로수"]!=null);
  const last=[...(data.records||[])].reverse().find(r=>r["종료키로수"]!==""&&r["종료키로수"]!=null);
  const html=`<html><head><meta charset="utf-8"><style>body{font-family:Malgun Gothic,sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:6px;text-align:center}h1{text-align:center}.meta td{text-align:left}.blank{height:28px}</style></head><body><h1>차 량 운 행 일 지</h1><table class="meta"><tr><td><b>조회월</b> ${xlsEscape(month)}</td><td><b>차량번호</b> ${xlsEscape(vehicle)}</td><td><b>시설명</b> ${xlsEscape(data.facility||state.facility||"")}</td></tr><tr><td><b>전일지침</b> ${xlsEscape(first?first["출발키로수"]:"")} km</td><td><b>금일운행거리</b> ${xlsEscape(total)} km</td><td><b>금일지침</b> ${xlsEscape(last?last["종료키로수"]:"")} km</td></tr><tr><td><b>금일급유량</b> </td><td><b>급유액</b> </td><td><b>사용전표/누계전표</b> </td></tr></table><br><table><thead><tr><th>일자</th><th>운전자</th><th>승차자</th><th>용무</th><th>행선지</th><th>출발</th><th>도착</th><th>운행거리(km)</th><th>비고</th></tr></thead><tbody>${rows||`<tr><td colspan="9" class="blank">해당 월 운행기록 없음</td></tr>`}</tbody></table></body></html>`;
  const blob=new Blob(["\ufeff",html],{type:"application/vnd.ms-excel;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`차량운행일지_${vehicle}_${month}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

$("#downloadReportBtn").onclick=async()=>{
  const vehicle=$("#reportVehicle").value,month=$("#reportMonth").value;
  if(!vehicle||!month)return alert("차량번호와 조회 월을 선택해 주세요.");
  try{const data=await api("getMonthlyReport",{vehicle,month});downloadMonthlyXls(data,vehicle,month)}catch(e){alert(e.message)}
};

$("#saveAdminBtn").onclick=async()=>{
  try{
    await api("saveSettings",{pin:$("#adminPin").value,settings:{facility:$("#facilityNameAdmin").value.trim(),vehicles:state.vehicles.filter(Boolean),users:state.users.filter(Boolean),purposes:state.purposes.filter(Boolean)}});
    alert("저장했습니다.");
    await load();
  }catch(e){alert(e.message)}
};

load();