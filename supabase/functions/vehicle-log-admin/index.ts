import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};

const out=(body,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...cors,"Content-Type":"application/json; charset=utf-8"}
});

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
  if(req.method!=="POST") return out({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL");
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!serviceKey) return out({error:"Server configuration error"},500);

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

  const authHeader=req.headers.get("Authorization")||"";
  const token=authHeader.replace(/^Bearer\s+/i,"");
  const {data:userData,error:userError}=await admin.auth.getUser(token);
  if(userError||!userData.user) return out({error:"로그인이 필요합니다."},401);

  const {data:profile,error:profileError}=await admin
    .from("profiles").select("role").eq("id",userData.user.id).maybeSingle();

  if(profileError) return out({error:profileError.message},500);
  if(!profile||profile.role!=="superadmin") return out({error:"최고관리자 권한이 필요합니다."},403);

  const body=await req.json().catch(()=>({}));
  const action=String(body.action||"");

  const getManagedFacilities=async()=>{
    const {data:profiles,error:profilesError}=await admin
      .from("profiles").select("id,facility_id,display_name,role").eq("role","admin");
    if(profilesError) throw profilesError;

    const facilityIds=[...new Set((profiles||[]).map(x=>x.facility_id).filter(Boolean))];
    let facilities=[];
    if(facilityIds.length){
      const {data,error}=await admin
        .from("facilities").select("id,code,name,is_active").in("id",facilityIds).order("name");
      if(error) throw error;
      facilities=data||[];
    }
    return {profiles:profiles||[],facilities,facilityIds};
  };

  if(action==="list"){
    try{
      const {profiles,facilities}=await getManagedFacilities();
      const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if(usersError) return out({error:usersError.message},500);

      const facilityMap=Object.fromEntries(facilities.map(f=>[f.id,f]));
      const userMap=Object.fromEntries((usersData?.users||[]).map(u=>[u.id,u]));
      const admins=profiles.map(p=>{
        const facility=facilityMap[p.facility_id]||null;
        const user=userMap[p.id]||null;
        const email=String(user?.email||"");
        const loginId=email.endsWith("@vehiclelog.local")?email.replace(/@vehiclelog\.local$/,"").toUpperCase():email;
        return {id:p.id,displayName:p.display_name,loginId,facility};
      }).filter(x=>x.facility).sort((a,b)=>String(a.facility.name).localeCompare(String(b.facility.name),"ko"));
      return out({ok:true,admins});
    }catch(error){return out({error:error.message||"목록 조회 실패"},500)}
  }

  if(action==="overview"){
    try{
      const {facilities,facilityIds}=await getManagedFacilities();
      if(!facilityIds.length) return out({ok:true,facilities:[],vehicles:[],members:[],activeTrips:[]});

      const [vehiclesRes,membersRes,tripsRes]=await Promise.all([
        admin.from("vehicles").select("*").in("facility_id",facilityIds).order("plate_number"),
        admin.from("facility_members").select("id,facility_id,name,is_active,sort_order").in("facility_id",facilityIds).order("name"),
        admin.from("trips").select("id,facility_id,vehicle_id,driver_id,start_at,destination,status").in("facility_id",facilityIds).eq("status","active").order("start_at")
      ]);
      if(vehiclesRes.error) throw vehiclesRes.error;
      if(membersRes.error) throw membersRes.error;
      if(tripsRes.error) throw tripsRes.error;

      const vehicles=vehiclesRes.data||[],members=membersRes.data||[],activeTrips=tripsRes.data||[];
      const odometerPairs=await Promise.all(vehicles.map(async vehicle=>{
        const {data,error}=await admin
          .from("trips")
          .select("vehicle_id,end_odometer,end_at")
          .eq("vehicle_id",vehicle.id)
          .eq("status","ended")
          .not("end_odometer","is",null)
          .order("end_at",{ascending:false})
          .limit(1);
        if(error) throw error;
        const trip=data?.[0];
        return trip?[vehicle.id,trip.end_odometer]:null;
      }));
      const vehicleOdometers=Object.fromEntries(odometerPairs.filter(Boolean));

      const stats=facilities.map(f=>{
        const fv=vehicles.filter(v=>v.facility_id===f.id&&v.is_active);
        const fm=members.filter(m=>m.facility_id===f.id&&m.is_active);
        const ft=activeTrips.filter(t=>t.facility_id===f.id);
        return {
          facility:f,
          vehicleCount:fv.length,
          memberCount:fm.length,
          activeVehicleCount:new Set(ft.map(t=>t.vehicle_id)).size,
          activeDriverCount:new Set(ft.map(t=>t.driver_id)).size
        };
      });
      return out({ok:true,facilities,vehicles,members,activeTrips,vehicleOdometers,stats});
    }catch(error){return out({error:error.message||"현황 조회 실패"},500)}
  }

  if(action==="updateAccount"){
    const userId=String(body.userId||"").trim();
    const facilityCode=String(body.facilityCode||"").trim().toUpperCase();
    const loginId=String(body.loginId||"").trim().toLowerCase();
    const password=String(body.password||"");

    if(!userId) return out({error:"관리자 계정을 확인해주세요."},400);
    if(!/^[A-Z0-9_-]{2,30}$/.test(facilityCode)) return out({error:"시설 코드는 영문, 숫자, _ , - 조합 2~30자로 입력해주세요."},400);
    if(!/^[a-z0-9_-]{1,30}$/.test(loginId)) return out({error:"관리자 ID는 영문, 숫자, _ , - 조합으로 입력해주세요."},400);

    try{
      const {data:targetProfile,error:profileError}=await admin
        .from("profiles").select("id,facility_id,role").eq("id",userId).maybeSingle();
      if(profileError) throw profileError;
      if(!targetProfile||targetProfile.role!=="admin") return out({error:"변경할 시설 관리자 계정을 찾을 수 없습니다."},404);

      const {data:facility,error:facilityError}=await admin
        .from("facilities").select("id,code,name").eq("id",targetProfile.facility_id).maybeSingle();
      if(facilityError) throw facilityError;
      if(!facility) return out({error:"연결된 시설 정보를 찾을 수 없습니다."},404);

      const {data:duplicateFacility,error:dupFacilityError}=await admin
        .from("facilities").select("id").eq("code",facilityCode).neq("id",facility.id).limit(1);
      if(dupFacilityError) throw dupFacilityError;
      if((duplicateFacility||[]).length) return out({error:"이미 사용 중인 시설 코드입니다."},409);

      const {data:usersData,error:usersError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
      if(usersError) throw usersError;
      const newEmail=loginId+"@vehiclelog.local";
      const duplicateUser=(usersData?.users||[]).find(u=>u.id!==userId&&String(u.email||"").toLowerCase()===newEmail);
      if(duplicateUser) return out({error:"이미 사용 중인 관리자 ID입니다."},409);

      const {data:targetUser,error:getUserError}=await admin.auth.admin.getUserById(userId);
      if(getUserError||!targetUser?.user) return out({error:getUserError?.message||"관리자 계정을 찾을 수 없습니다."},404);
      const oldEmail=String(targetUser.user.email||"");
      const oldCode=String(facility.code||"");

      if(facilityCode!==oldCode){
        const {error:updateFacilityError}=await admin
          .from("facilities").update({code:facilityCode}).eq("id",facility.id);
        if(updateFacilityError) throw updateFacilityError;
      }

      const authChanges:any={};
      if(newEmail!==oldEmail.toLowerCase()){
        authChanges.email=newEmail;
        authChanges.email_confirm=true;
      }
      if(password) authChanges.password=password;
      if(Object.keys(authChanges).length){
        const {error:updateUserError}=await admin.auth.admin.updateUserById(userId,authChanges);
        if(updateUserError){
          if(facilityCode!==oldCode){
            await admin.from("facilities").update({code:oldCode}).eq("id",facility.id);
          }
          return out({error:updateUserError.message},400);
        }
      }

      return out({
        ok:true,
        facilityCode,
        loginId:loginId.toUpperCase(),
        passwordChanged:Boolean(password)
      });
    }catch(error){
      return out({error:error.message||"계정 정보 변경 실패"},500);
    }
  }

  if(action==="resetPassword"){
    const userId=String(body.userId||"").trim();
    const password=String(body.password||"");
    if(!userId||!password) return out({error:"관리자 계정과 새 비밀번호를 확인해주세요."},400);
    try{
      const {data:targetProfile,error:targetProfileError}=await admin
        .from("profiles").select("id,role").eq("id",userId).maybeSingle();
      if(targetProfileError) throw targetProfileError;
      if(!targetProfile||targetProfile.role!=="admin") return out({error:"변경할 시설 관리자 계정을 찾을 수 없습니다."},404);
      const {error:updateError}=await admin.auth.admin.updateUserById(userId,{password});
      if(updateError) return out({error:updateError.message},400);
      return out({ok:true});
    }catch(error){
      return out({error:error.message||"비밀번호 변경 실패"},500);
    }
  }

  if(action==="resetTrips"){
    try{
      const {data:deleted,error:deleteError}=await admin
        .from("trips")
        .delete()
        .not("id","is",null)
        .select("id");
      if(deleteError) throw deleteError;
      return out({ok:true,deletedCount:(deleted||[]).length});
    }catch(error){
      return out({error:error.message||"운행 데이터 초기화 실패"},500);
    }
  }

  if(action==="report"){
    try{
      const vehicleId=String(body.vehicleId||"");
      const month=String(body.month||"");
      if(!vehicleId||!/^[0-9]{4}-[0-9]{2}$/.test(month)) return out({error:"차량과 조회 월을 확인해주세요."},400);

      const {facilities,facilityIds}=await getManagedFacilities();
      const {data:vehicle,error:vehicleError}=await admin
        .from("vehicles").select("id,facility_id,plate_number,label").eq("id",vehicleId).maybeSingle();
      if(vehicleError) throw vehicleError;
      if(!vehicle||!facilityIds.includes(vehicle.facility_id)) return out({error:"조회 권한이 없는 차량입니다."},403);

      const facility=facilities.find(f=>f.id===vehicle.facility_id);
      const nextMonth=new Date(month+"-01T00:00:00+09:00");
      nextMonth.setMonth(nextMonth.getMonth()+1);
      const start=month+"-01T00:00:00+09:00";

      const [membersRes,purposesRes,tripsRes]=await Promise.all([
        admin.from("facility_members").select("id,name").eq("facility_id",vehicle.facility_id),
        admin.from("trip_purposes").select("id,name").is("facility_id",null),
        admin.from("trips").select("*").eq("facility_id",vehicle.facility_id).eq("vehicle_id",vehicleId).eq("status","ended").gte("start_at",start).lt("start_at",nextMonth.toISOString()).order("admin_sort_order",{ascending:true,nullsFirst:false}).order("start_at",{ascending:true})
      ]);
      if(membersRes.error) throw membersRes.error;
      if(purposesRes.error) throw purposesRes.error;
      if(tripsRes.error) throw tripsRes.error;

      return out({ok:true,facility,vehicle,members:membersRes.data||[],purposes:purposesRes.data||[],trips:tripsRes.data||[]});
    }catch(error){return out({error:error.message||"운행일지 조회 실패"},500)}
  }

  if(action==="create"){
    const facilityName=String(body.facilityName||"").trim();
    const facilityCode=String(body.facilityCode||"").trim().toUpperCase();
    const loginId=String(body.loginId||"").trim().toLowerCase();
    const password=String(body.password||"");

    if(!facilityName) return out({error:"시설명을 입력해주세요."},400);
    if(!/^[A-Z0-9_-]{2,30}$/.test(facilityCode)) return out({error:"시설 코드를 확인해주세요."},400);
    if(!/^[a-z0-9_-]{1,30}$/.test(loginId)) return out({error:"관리자 ID는 영문, 숫자, _ , - 조합으로 입력해주세요."},400);
    if(!password) return out({error:"초기 비밀번호를 입력해주세요."},400);

    const {data:facility,error:facilityError}=await admin
      .from("facilities").insert({code:facilityCode,name:facilityName,is_active:true})
      .select("id,code,name,is_active").single();

    if(facilityError){
      if(facilityError.code==="23505") return out({error:"이미 사용 중인 시설 코드입니다."},409);
      return out({error:facilityError.message},500);
    }

    const email=loginId+"@vehiclelog.local";
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(createError||!created.user){
      await admin.from("facilities").delete().eq("id",facility.id);
      return out({error:createError?.message||"계정 생성에 실패했습니다."},400);
    }

    const {error:linkError}=await admin.from("profiles").insert({
      id:created.user.id,facility_id:facility.id,display_name:"시설 관리자",role:"admin"
    });
    if(linkError){
      await admin.auth.admin.deleteUser(created.user.id);
      await admin.from("facilities").delete().eq("id",facility.id);
      return out({error:linkError.message},500);
    }

    return out({ok:true,facility,loginId:loginId.toUpperCase()});
  }

  return out({error:"Unknown action"},400);
});
