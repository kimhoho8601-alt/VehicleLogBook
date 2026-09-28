const SHEETS={config:"설정",vehicles:"차량",users:"사용자",options:"선택항목",logs:"운행기록"};

function doPost(e){
  try{
    const q=JSON.parse(e.postData.contents||"{}");
    const fn={bootstrap,startTrip,endTrip,saveSettings,getMonthlyReport}[q.action];
    if(!fn)throw Error("알 수 없는 action");
    return json(true,fn(q));
  }catch(err){
    return json(false,null,String(err.message||err));
  }
}

function json(ok,data,error){
  return ContentService.createTextOutput(JSON.stringify({ok:ok,data:data,error:error}))
    .setMimeType(ContentService.MimeType.JSON);
}

function sh(name){
  const s=SpreadsheetApp.getActive().getSheetByName(name);
  if(!s)throw Error("시트 없음: "+name);
  return s;
}

function table(name){
  const s=sh(name);
  if(s.getLastRow()<1||s.getLastColumn()<1)return [];
  const v=s.getDataRange().getValues();
  const h=v[0].map(String);
  return v.slice(1)
    .filter(r=>r.some(x=>x!==""))
    .map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])));
}

function cfg(){
  return Object.fromEntries(table(SHEETS.config).map(r=>[String(r["항목명"]),r["값"]]));
}

function colMap(sheet){
  const h=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  return Object.fromEntries(h.map((x,i)=>[x,i+1]));
}

function appendByHeader(sheetName,obj){
  const s=sh(sheetName),m=colMap(s),row=Array(s.getLastColumn()).fill("");
  Object.entries(obj).forEach(([k,v])=>{if(m[k])row[m[k]-1]=v});
  s.appendRow(row);
}

function enabledList(sheetName,key){
  return table(sheetName)
    .filter(r=>String(r["사용여부"]).toUpperCase()!=="N")
    .sort((a,b)=>Number(a["정렬순서"]||999)-Number(b["정렬순서"]||999))
    .map(r=>String(r[key]))
    .filter(Boolean);
}

function bootstrap(){
  const c=cfg();
  const vehicles=enabledList(SHEETS.vehicles,"차량번호");
  const users=enabledList(SHEETS.users,"이름");
  const purposes=table(SHEETS.options)
    .filter(r=>r["구분"]==="운행목적"&&String(r["사용여부"]).toUpperCase()!=="N")
    .sort((a,b)=>Number(a["정렬순서"]||999)-Number(b["정렬순서"]||999))
    .map(r=>String(r["항목명"]));
  return {facility:c["시설명"]||"",vehicles:vehicles,users:users,purposes:purposes,active:getActive()};
}

function getActive(){
  const a={};
  table(SHEETS.logs).forEach(r=>{
    if(r["상태"]==="운행중"){
      a[String(r["차량번호"])]={
        recordId:r["기록ID"],driver:r["운행자"],passengers:r["동승자"],
        purpose:r["운행목적"],destination:r["행선지"],startKm:r["출발키로수"],startTime:r["출발시각"]
      };
    }
  });
  return a;
}

function startTrip(q){
  const lock=LockService.getScriptLock();
  lock.waitLock(10000);
  try{
    const active=getActive();
    if(active[q.vehicle])throw Error(active[q.vehicle].driver+" 님이 운전 중입니다.");
    const now=new Date(),id=Utilities.getUuid();
    const tz=Session.getScriptTimeZone()||"Asia/Seoul";
    const tripMonth=Utilities.formatDate(now,tz,"yyyy-MM");
    const tripDate=Utilities.formatDate(now,tz,"yyyy-MM-dd");
    appendByHeader(SHEETS.logs,{
      "기록ID":id,"운행월":tripMonth,"운행일자":tripDate,"차량번호":q.vehicle,"운행자":q.driver,
      "동승자":(q.passengers||[]).join(", "),"운행목적":q.purpose,
      "행선지":q.destination,"출발키로수":q.startKm,"출발시각":now,
      "상태":"운행중","작성일시":now
    });
    return {recordId:id,driver:q.driver,destination:q.destination,startKm:q.startKm,startTime:now};
  }finally{
    lock.releaseLock();
  }
}

function endTrip(q){
  const s=sh(SHEETS.logs),m=colMap(s),vals=s.getDataRange().getValues();
  for(let i=vals.length-1;i>=1;i--){
    if(String(vals[i][m["차량번호"]-1])===String(q.vehicle)&&String(vals[i][m["상태"]-1])==="운행중"){
      const start=Number(vals[i][m["출발키로수"]-1]||0);
      if(Number(q.endKm)<start)throw Error("도착 키로수는 출발 키로수보다 작을 수 없습니다.");
      s.getRange(i+1,m["종료키로수"]).setValue(Number(q.endKm));
      s.getRange(i+1,m["종료시각"]).setValue(new Date());
      s.getRange(i+1,m["운행거리"]).setValue(Number(q.endKm)-start);
      s.getRange(i+1,m["상태"]).setValue("운행종료");
      return true;
    }
  }
  throw Error("운행 중인 기록을 찾을 수 없습니다.");
}

function requirePin(pin){
  if(String(pin)!==String(cfg()["관리자PIN"]))throw Error("관리자 PIN이 올바르지 않습니다.");
}

function rewriteList(sheetName,header,items){
  const s=sh(sheetName);
  if(s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).clearContent();
  items.forEach((x,i)=>appendByHeader(sheetName,{[header]:x,"사용여부":"Y","정렬순서":i+1}));
}

function getMonthlyReport(q){
  const c=cfg();
  const records=table(SHEETS.logs)
    .filter(r=>String(r["차량번호"])===String(q.vehicle)&&String(r["운행월"])===String(q.month)&&String(r["상태"])==="운행종료")
    .sort((a,b)=>new Date(a["출발시각"]||a["운행일자"])-new Date(b["출발시각"]||b["운행일자"]));
  return {facility:c["시설명"]||"",records:records};
}

function saveSettings(q){
  requirePin(q.pin);
  const configSheet=sh(SHEETS.config),configRows=table(SHEETS.config),configMap=colMap(configSheet);
  if(q.settings.facility!==undefined){
    const idx=configRows.findIndex(r=>String(r["항목명"])==="시설명");
    if(idx>=0)configSheet.getRange(idx+2,configMap["값"]).setValue(q.settings.facility);
    else appendByHeader(SHEETS.config,{"항목명":"시설명","값":q.settings.facility,"설명":"앱 상단에 표시"});
  }
  rewriteList(SHEETS.vehicles,"차량번호",q.settings.vehicles||[]);
  rewriteList(SHEETS.users,"이름",q.settings.users||[]);
  const s=sh(SHEETS.options);
  if(s.getLastRow()>1)s.getRange(2,1,s.getLastRow()-1,s.getLastColumn()).clearContent();
  (q.settings.purposes||[]).forEach((x,i)=>appendByHeader(SHEETS.options,{"구분":"운행목적","항목명":x,"사용여부":"Y","정렬순서":i+1}));
  return true;
}