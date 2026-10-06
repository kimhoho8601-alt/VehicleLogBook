// Vehicle registration and editing. Uses the existing authenticated REST requests.
const vehicleOwnershipLabels={purchase:'구입',rent:'렌트',lease:'리스',donation:'기증',other:'기타'};
const vehicleFuelLabels={gasoline:'휘발유',diesel:'경유',lpg:'LPG',hybrid:'하이브리드',electric:'전기',hydrogen:'수소',other:'기타'};
const vehicleStatusLabels={in_service:'사용 중',maintenance:'정비 중',suspended:'운행 중지',disposed:'처분'};
function vehicleStatusText(v){return vehicleStatusLabels[v.operating_status]||(v.is_active?'사용 중':'운행 중지')}
function vehicleSummaryMarkup(v,members=[]){
  const manager=members.find(m=>m.id===v.manager_member_id&&m.facility_id===v.facility_id);
  const details=[v.vehicle_type,v.model_name,v.model_year?`${v.model_year}년식`:null,vehicleOwnershipLabels[v.ownership_type]];
  return `${details.filter(Boolean).length?`<small>${details.filter(Boolean).map(esc).join(' · ')}</small>`:''}${manager?`<small>담당: ${esc(manager.name)}</small>`:''}`;
}
function vehicleOptionsMarkup(labels,value,empty='선택 안 함'){
  return `<option value="">${empty}</option>`+Object.entries(labels).map(([key,label])=>`<option value="${key}" ${key===value?'selected':''}>${esc(label)}</option>`).join('');
}
function vehicleInput(name,label,value,type='text',attrs=''){
  return `<label class="field"><span>${label}</span><input class="input" name="${name}" type="${type}" value="${esc(value??'')}" ${attrs}></label>`;
}
function vehicleManagerOptions(members,facilityId,selected=''){
  return '<option value="">담당자 선택 안 함</option>'+members
    .filter(m=>m.facility_id===facilityId&&(m.is_active||m.id===selected))
    .sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko'))
    .map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name)}${m.is_active?'':' (사용 안 함)'}</option>`).join('');
}
window.openVehicleEditor=async function(id='',initialFacilityId=''){
  try{
    const master=state.admin.profile.role==='superadmin';
    let vehicles,members,facilities;
    if(master){const o=await getOverview(true);({vehicles,members,facilities}=o)}
    else{
      facilities=[state.admin.facility];
      [vehicles,members]=await Promise.all([
        restRequest('vehicles?select=*&facility_id='+eq(state.admin.facility.id)),
        restRequest('facility_members?select=*&facility_id='+eq(state.admin.facility.id)+'&order=name.asc')
      ]);
    }
    vehicles=vehicles||[];members=members||[];facilities=facilities||[];
    const vehicle=id?vehicles.find(v=>v.id===id):{};
    if(!vehicle)throw Error('차량 정보를 찾을 수 없습니다.');
    const facilityId=id?vehicle.facility_id:(master?(initialFacilityId||document.getElementById('globalFacility')?.value||''):state.admin.facility.id);
    const selectedFacility=facilities.some(f=>f.id===facilityId)?facilityId:'';
    state.vehicleEditor={id,vehicle,members,facilities,master};
    const v=vehicle;
    const field=(key,label,type='text',attrs='')=>vehicleInput(key,label,v[key],type,attrs);
    const money=(key,label)=>field(key,label,'number','min="0" max="999999999999.99" step="0.01" inputmode="decimal"');
    const dates=(key,label)=>field(key,label,'date');
    showAdminModal(`<div class="admin-modal-head"><div><span class="modal-kicker">차량 정보</span><h2>${id?'차량 정보 수정':'차량 등록'}</h2><p>차량번호와 시설을 입력하고, 나머지 정보는 확인된 항목만 입력하세요.</p></div><button class="modal-close" onclick="closeAdminModal()" aria-label="닫기">×</button></div>
      <form id="vehicleInfoForm" onsubmit="event.preventDefault();saveVehicleInfo()">
        <section class="vehicle-info-section"><h3>기본정보</h3><div class="vehicle-info-grid">
          <label class="field"><span>시설 <em>필수</em></span><select class="select" name="facility_id" required ${id||!master?'disabled':''} onchange="changeVehicleEditorFacility(this.value)"><option value="">시설 선택</option>${facilities.map(f=>`<option value="${esc(f.id)}" ${selectedFacility===f.id?'selected':''}>${esc(f.name)} (${esc(f.code)})</option>`).join('')}</select></label>
          ${field('plate_number','차량번호 <em>필수</em>','text','required maxlength="30" placeholder="예: 12가3456"')}
          ${field('vehicle_type','차종','text','maxlength="60" placeholder="예: 승용 / 승합 / 화물"')}
          ${field('model_name','차명','text','maxlength="100" placeholder="예: 아반떼 / 스타리아"')}
          ${field('model_year','연식','number','min="1900" max="2100" step="1" placeholder="예: 2023"')}
          ${dates('acquired_on','취득일 / 사용 시작일')}
          <label class="field"><span>연료 종류</span><select name="fuel_type" class="select">${vehicleOptionsMarkup(vehicleFuelLabels,v.fuel_type)}</select></label>
          <label class="field"><span>관리 담당자</span><select id="vehicleManagerSelect" name="manager_member_id" class="select">${vehicleManagerOptions(members,selectedFacility,v.manager_member_id)}</select><small>해당 시설의 직원 등록 목록에서 선택합니다.</small></label>
          <label class="field"><span>차량 상태</span><select name="operating_status" class="select">${vehicleOptionsMarkup(vehicleStatusLabels,v.operating_status||(v.is_active===false?'suspended':'in_service')).replace('<option value="">선택 안 함</option>','')}</select></label>
          <label class="field"><span>소유방식</span><select id="vehicleOwnershipSelect" name="ownership_type" class="select" onchange="updateVehicleOwnershipFields(this.value)">${vehicleOptionsMarkup(vehicleOwnershipLabels,v.ownership_type)}</select></label>
        </div></section>
        <fieldset id="vehiclePurchaseFields" class="vehicle-info-section"><legend>구입 정보</legend><div class="vehicle-info-grid">${money('purchase_price','취득금액 (원)')}</div></fieldset>
        <fieldset id="vehicleContractFields" class="vehicle-info-section"><legend>렌트·리스 계약정보</legend><div class="vehicle-info-grid">
          ${field('contract_company','계약업체','text','maxlength="100"')}${money('monthly_fee','월 이용료 (원)')}
          ${dates('contract_start_on','계약 시작일')}${dates('contract_end_on','계약 종료일')}
          ${field('annual_mileage_limit','연간 약정거리 (km)','number','min="0" max="2147483647" step="1"')}
        </div></fieldset>
        <fieldset id="vehicleDonationFields" class="vehicle-info-section"><legend>기증 정보</legend><div class="vehicle-info-grid">
          ${field('donor_name','기증기관','text','maxlength="100"')}${dates('donated_on','기증일')}${money('appraised_value','평가금액 (원)')}
        </div></fieldset>
        <details class="vehicle-info-section vehicle-schedule" ${v.insurance_expires_on||v.inspection_due_on||v.next_service_on||v.next_service_odometer!=null?'open':''}><summary>보험·검사·정비 일정 <span>선택 입력</span></summary><div class="vehicle-info-grid">
          ${dates('insurance_expires_on','보험 만료일')}${dates('inspection_due_on','다음 정기검사 기한')}${dates('next_service_on','다음 정비 예정일')}
          ${field('next_service_odometer','다음 정비 예정 키로수 (km)','number','min="0" max="99999999999.9" step="0.1" inputmode="decimal"')}
        </div></details>
        <div class="modal-actions"><button type="button" class="btn light" onclick="closeAdminModal()">취소</button><button id="saveVehicleInfoButton" type="submit" class="btn primary">${id?'변경사항 저장':'차량 등록'}</button></div>
      </form>`);
    document.querySelector('#adminModal .admin-modal')?.classList.add('vehicle-info-modal');
    updateVehicleOwnershipFields(v.ownership_type||'');
  }catch(error){toast(error.message||'차량 정보를 불러오지 못했습니다.')}
};
window.changeVehicleEditorFacility=function(facilityId){
  const editor=state.vehicleEditor;
  if(!editor||editor.id||!editor.master)return;
  const select=document.getElementById('vehicleManagerSelect');
  if(select)select.innerHTML=vehicleManagerOptions(editor.members,facilityId);
};
window.updateVehicleOwnershipFields=function(type){
  for(const [id,visible] of [['vehiclePurchaseFields',type==='purchase'],['vehicleContractFields',type==='rent'||type==='lease'],['vehicleDonationFields',type==='donation']]){
    const fieldset=document.getElementById(id);
    if(fieldset){fieldset.hidden=!visible;fieldset.disabled=!visible;}
  }
};
function buildVehicleInfoPayload(values,editor){
  const payload={};
  const text=key=>String(values[key]??'').trim();
  payload.facility_id=editor.id?editor.vehicle.facility_id:(editor.master?text('facility_id'):state.admin.facility.id);
  if(!editor.facilities.some(f=>f.id===payload.facility_id))throw Error('시설을 선택해주세요.');
  payload.plate_number=text('plate_number');
  if(!payload.plate_number||payload.plate_number.length>30)throw Error('차량번호를 확인해주세요.');
  for(const [key,max] of [['vehicle_type',60],['model_name',100],['contract_company',100],['donor_name',100]]){
    payload[key]=text(key)||null;if((payload[key]?.length||0)>max)throw Error('입력한 내용이 너무 깁니다.');
  }
  for(const [key,labels] of [['ownership_type',vehicleOwnershipLabels],['fuel_type',vehicleFuelLabels],['operating_status',vehicleStatusLabels]]){
    const value=text(key);if(value&&!Object.hasOwn(labels,value))throw Error('차량 선택정보를 확인해주세요.');
    payload[key]=value||null;
  }
  if(!payload.operating_status)throw Error('차량 상태를 선택해주세요.');
  payload.manager_member_id=text('manager_member_id')||null;
  if(payload.manager_member_id&&!editor.members.some(m=>m.id===payload.manager_member_id&&m.facility_id===payload.facility_id&&(m.is_active||m.id===editor.vehicle.manager_member_id)))throw Error('해당 시설에 등록된 담당자를 선택해주세요.');
  for(const [key,max,integer,min] of [['model_year',2100,true,1900],['purchase_price',999999999999.99,false,0],['monthly_fee',999999999999.99,false,0],['annual_mileage_limit',2147483647,true,0],['appraised_value',999999999999.99,false,0],['next_service_odometer',99999999999.9,false,0]]){
    const raw=text(key);const value=raw?Number(raw):null;
    if(value!==null&&(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value))))throw Error('연식·금액·키로수 입력값을 확인해주세요.');
    payload[key]=value;
  }
  for(const key of ['acquired_on','contract_start_on','contract_end_on','donated_on','insurance_expires_on','inspection_due_on','next_service_on']){
    const value=text(key);
    if(value&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))throw Error('날짜를 확인해주세요.');
    payload[key]=value||null;
  }
  if(payload.ownership_type!=='purchase')payload.purchase_price=null;
  if(!['rent','lease'].includes(payload.ownership_type))for(const key of ['contract_company','monthly_fee','contract_start_on','contract_end_on','annual_mileage_limit'])payload[key]=null;
  if(payload.ownership_type!=='donation')for(const key of ['donor_name','donated_on','appraised_value'])payload[key]=null;
  if(payload.contract_start_on&&payload.contract_end_on&&payload.contract_start_on>payload.contract_end_on)throw Error('계약 종료일은 시작일보다 빠를 수 없습니다.');
  return payload;
}
window.saveVehicleInfo=async function(){
  const editor=state.vehicleEditor,form=document.getElementById('vehicleInfoForm'),button=document.getElementById('saveVehicleInfoButton');
  if(!editor||!form||button?.disabled||!form.reportValidity())return;
  let payload;
  try{
    const values=Object.fromEntries(new FormData(form).entries());
    payload=buildVehicleInfoPayload(values,editor);
  }catch(error){return toast(error.message)}
  if(button){button.disabled=true;button.textContent='저장 중...';}
  try{
    const target=editor.id?'vehicles?id='+eq(editor.id)+'&facility_id='+eq(payload.facility_id):'vehicles';
    if(!editor.id)payload.sort_order=999;
    const saved=await restRequest(target,{method:editor.id?'PATCH':'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(payload)});
    if(!saved?.length)throw Error('차량을 저장하지 못했습니다. 권한과 차량 정보를 확인해주세요.');
    closeAdminModal();state.vehicleEditor=null;state.overview=null;state.adminTab='vehicles';
    if(!editor.master)await loadAdminContext();
    await renderAdminHome();toast(editor.id?'차량 정보를 수정했습니다.':'차량을 등록했습니다.');
  }catch(error){
    toast(error.message||'차량을 저장하지 못했습니다.');
    if(button){button.disabled=false;button.textContent=editor.id?'변경사항 저장':'차량 등록';}
  }
};
