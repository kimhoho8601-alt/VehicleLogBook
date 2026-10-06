// Requires Playwright and a Chromium executable. All requests use local fixtures.
// CHROMIUM_EXECUTABLE=/path/to/chromium node tests/browser-vehicle-info.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
  try{
    for(const master of [false,true]){
      const context=await browser.newContext({viewport:master?{width:1440,height:1000}:{width:390,height:844}});
      const page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.hostname!=='vehiclelog.test')return route.abort();
        const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
        if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
        await route.fulfill({path:file,contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/json'});
      });
      await page.goto('http://vehiclelog.test/');
      await page.getByRole('heading',{name:'관리자 로그인'}).waitFor();
      assert.equal(await page.evaluate(()=>typeof QRCode.toCanvas),'function');
      await page.evaluate(master=>{
        window.fixture={facilities:[{id:'f1',code:'F1',name:'첫 시설'},{id:'f2',code:'F2',name:'둘째 시설'}],vehicles:[],members:[{id:'m1',facility_id:'f1',name:'첫 담당자',is_active:true},{id:'m2',facility_id:'f2',name:'둘째 담당자',is_active:true}],activeTrips:[]};
        window.saved=[];
        state.admin={profile:{role:master?'superadmin':'admin',display_name:'테스트'},facility:fixture.facilities[0],vehicles:fixture.vehicles,members:fixture.members.filter(m=>m.facility_id==='f1'),purposes:[]};state.adminTab='vehicles';
        getOverview=async()=>fixture;
        loadAdminContext=async()=>{};
        restRequest=async(url,opts={})=>{
          if(opts.method==='POST'&&url==='vehicles'){
            const row={...JSON.parse(opts.body),id:'v'+(fixture.vehicles.length+1),is_active:true};fixture.vehicles.push(row);saved.push({url,opts,row});return [row];
          }
          if(opts.method==='PATCH'){
            const row={...fixture.vehicles[0],...JSON.parse(opts.body)};fixture.vehicles[0]=row;state.admin.vehicles=fixture.vehicles;saved.push({url,opts,row});return [row];
          }
          if(url.startsWith('vehicles?'))return fixture.vehicles;
          if(url.startsWith('facility_members?'))return master?fixture.members:fixture.members.filter(m=>m.facility_id==='f1');
          return [];
        };
      },master);
      await page.evaluate(()=>renderAdminHome());
      await page.getByRole('button',{name:'차량 등록',exact:true}).click();
      const form=page.locator('#vehicleInfoForm');await form.waitFor();
      assert.equal(await form.locator('[name="facility_id"]').isDisabled(),!master);
      if(master)await form.locator('[name="facility_id"]').selectOption('f1');
      assert((await form.locator('[name="manager_member_id"]').textContent()).includes('첫 담당자'));
      assert(!(await form.locator('[name="manager_member_id"]').textContent()).includes('둘째 담당자'));
      await form.locator('[name="plate_number"]').fill('12가3456');
      await form.locator('[name="model_name"]').fill('아반떼');
      await form.locator('[name="model_year"]').fill('2023');
      await form.locator('[name="vehicle_type"]').fill('승용');
      await form.locator('[name="manager_member_id"]').selectOption('m1');
      await form.locator('[name="ownership_type"]').selectOption('purchase');
      assert(await page.locator('#vehiclePurchaseFields').isVisible());
      assert(!(await page.locator('#vehicleContractFields').isVisible()));
      await form.locator('[name="purchase_price"]').fill('30000000');
      await form.getByRole('button',{name:'차량 등록',exact:true}).click();
      await page.locator('#vehicleInfoForm').waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>saved[0].row.purchase_price),30000000);
      assert.equal(await page.evaluate(()=>saved[0].row.manager_member_id),'m1');
      assert((await page.locator('.admin-table').textContent()).includes('아반떼'));
      await page.getByRole('button',{name:'수정',exact:true}).click();await form.waitFor();
      assert.equal(await form.locator('[name="model_name"]').inputValue(),'아반떼');
      assert.equal(await form.locator('[name="purchase_price"]').inputValue(),'30000000');
      await form.locator('[name="ownership_type"]').selectOption('rent');
      assert(await page.locator('#vehicleContractFields').isVisible());
      assert(!(await page.locator('#vehiclePurchaseFields').isVisible()));
      await form.locator('[name="monthly_fee"]').fill('500000');
      await form.locator('[name="contract_start_on"]').fill('2026-10-10');
      await form.locator('[name="contract_end_on"]').fill('2026-10-01');
      await form.getByRole('button',{name:'변경사항 저장'}).click();
      assert.equal(await page.evaluate(()=>saved.length),1);
      assert((await page.locator('#toast').textContent()).includes('계약 종료일'));
      await form.locator('[name="contract_end_on"]').fill('2027-10-10');
      await form.getByRole('button',{name:'변경사항 저장'}).click();await form.waitFor({state:'detached'});
      assert.equal(await page.evaluate(()=>saved[1].row.purchase_price),null);
      assert.equal(await page.evaluate(()=>saved[1].row.monthly_fee),500000);
      if(master){
        await page.getByRole('button',{name:'차량 등록',exact:true}).click();await form.waitFor();
        await form.locator('[name="facility_id"]').selectOption('f1');await form.locator('[name="manager_member_id"]').selectOption('m1');
        await form.locator('[name="facility_id"]').selectOption('f2');
        assert.equal(await form.locator('[name="manager_member_id"]').inputValue(),'');
        assert(!(await form.locator('[name="manager_member_id"]').textContent()).includes('첫 담당자'));
        await form.locator('[name="manager_member_id"]').selectOption('m2');
        await form.locator('[name="plate_number"]').fill('22나2222');
        await form.locator('[name="ownership_type"]').selectOption('donation');
        assert(await page.locator('#vehicleDonationFields').isVisible());
        await form.locator('[name="donor_name"]').fill('기증기관');
        await form.getByRole('button',{name:'차량 등록',exact:true}).click();await form.waitFor({state:'detached'});
        assert.equal(await page.evaluate(()=>saved[2].row.facility_id),'f2');
        assert.equal(await page.evaluate(()=>saved[2].row.manager_member_id),'m2');
      }
      await page.getByRole('button',{name:'수정',exact:true}).first().click();await form.waitFor();
      assert.equal(await form.getByText('승차정원',{exact:false}).count(),0);
      assert.equal(await form.getByText('비고',{exact:true}).count(),0);
      assert(await form.getByText('보험·검사·정비 일정',{exact:false}).count());
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
      await page.screenshot({path:`/tmp/vehicle-info-${master?'master':'mobile'}.png`});
      await page.locator('.modal-close').click();
      const download=page.waitForEvent('download');
      await page.getByRole('button',{name:'Excel 다운로드',exact:true}).click();
      await (await download).saveAs(`/tmp/vehicle-export-${master?'master':'facility'}.xlsx`);
      if(master){
        await page.locator('#globalFacilityFilter').selectOption('f2');
        const filtered=page.waitForEvent('download');
        await page.getByRole('button',{name:'Excel 다운로드',exact:true}).click();
        await (await filtered).saveAs('/tmp/vehicle-export-filtered.xlsx');
      }
      assert.deepEqual(errors,[]);
      console.log('PASS browser:',master?'MASTER desktop facility switching and donation':'facility mobile registration and editing');
      await context.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
