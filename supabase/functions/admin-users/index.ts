const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AUTH_EMAIL_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'auth.taiyo-silver.internal';
const APP_ORIGIN = Deno.env.get('APP_ORIGIN') ?? '';

type Role='employee'|'office_admin'|'org_admin';
interface Caller { id:string; organization_id:string; office_id:string; role:Role; is_active:boolean; }
interface Body { action?:'create'|'deactivate'|'activate'; employeeId?:string; displayName?:string; password?:string; officeId?:string; phone?:string; role?:Role; profileId?:string; }

Deno.serve(async(request)=>{
  const cors=corsHeaders(request);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='POST')return json({message:'この操作には対応していません。'},405,cors);
  if(!originAllowed(request))return json({message:'この画面からは利用できません。'},403,cors);
  if(!SERVICE_ROLE_KEY)return json({message:'社員管理機能の設定が完了していません。'},503,cors);
  const auth=request.headers.get('Authorization')??'';
  const caller=await getCaller(auth);
  if(!caller?.is_active)return json({message:'ログインの有効期限が切れました。もう一度ログインしてください。'},401,cors);
  if(caller.role==='employee')return json({message:'社員を管理する権限がありません。'},403,cors);
  let body:Body;try{body=await request.json();}catch{return json({message:'入力内容を確認してください。'},400,cors);}
  try{
    if(body.action==='create')return await createEmployee(caller,body,cors);
    if(body.action==='deactivate'||body.action==='activate')return await setActive(caller,body.profileId??'',body.action==='activate',cors);
    return json({message:'操作内容を確認してください。'},400,cors);
  }catch(error){console.error('admin-users failed',error instanceof Error?error.message:'unknown');return json({message:'社員情報を更新できませんでした。入力内容を確認して、もう一度お試しください。'},400,cors);}
});

async function createEmployee(caller:Caller,body:Body,cors:Record<string,string>):Promise<Response>{
  const employeeId=normalizeEmployeeId(body.employeeId??'');const displayName=String(body.displayName??'').trim();const password=String(body.password??'');const phone=String(body.phone??'').trim();const officeId=String(body.officeId??'');const requestedRole=body.role??'employee';
  if(!employeeId||!displayName||!officeId||password.length<8)return json({message:'社員ID・氏名・営業所・8文字以上のパスワードを入力してください。'},400,cors);
  if(!['employee','office_admin','org_admin'].includes(requestedRole))return json({message:'権限の指定が正しくありません。'},400,cors);
  if(caller.role==='office_admin'&&(officeId!==caller.office_id||requestedRole!=='employee'))return json({message:'営業所管理者は、自営業所の一般社員のみ追加できます。'},403,cors);
  const office=await serviceRows<{id:string;organization_id:string}>(`/rest/v1/offices?id=eq.${encodeURIComponent(officeId)}&organization_id=eq.${encodeURIComponent(caller.organization_id)}&is_active=eq.true&select=id,organization_id`);
  if(!office[0])return json({message:'営業所が見つかりません。'},400,cors);
  const email=`${employeeId}@${AUTH_EMAIL_DOMAIN}`;
  const authResponse=await fetch(`${SUPABASE_URL}/auth/v1/admin/users`,{method:'POST',headers:serviceHeaders(),body:JSON.stringify({email,password,email_confirm:true,user_metadata:{employee_id:employeeId,display_name:displayName}})});
  const authPayload=await authResponse.json().catch(()=>({})) as {id?:string;message?:string;msg?:string};
  if(!authResponse.ok||!authPayload.id){const msg=String(authPayload.message??authPayload.msg??'');if(/already|registered|exists/i.test(msg))return json({message:'同じ社員IDがすでに登録されています。'},400,cors);return json({message:'社員アカウントを作成できませんでした。'},400,cors);}
  const userId=authPayload.id;
  const profile={id:userId,organization_id:caller.organization_id,office_id:officeId,employee_id:employeeId,display_name:displayName,phone,flyer_contact_name:displayName,mobile_phone:phone,role:caller.role==='office_admin'?'employee':requestedRole,is_active:true};
  const insert=await fetch(`${SUPABASE_URL}/rest/v1/profiles`,{method:'POST',headers:{...serviceHeaders(),Prefer:'return=representation'},body:JSON.stringify(profile)});
  const rows=await insert.json().catch(()=>[]) as Array<Record<string,unknown>>;
  if(!insert.ok){await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:'DELETE',headers:serviceHeaders()});return json({message:'同じ社員IDがすでに登録されているか、社員情報を保存できませんでした。'},400,cors);}
  const row=rows[0]??profile;
  return json({profile:mapProfile(row)},200,cors);
}

async function setActive(caller:Caller,profileId:string,active:boolean,cors:Record<string,string>):Promise<Response>{
  if(!profileId)return json({message:'対象の社員が見つかりません。'},400,cors);
  if(profileId===caller.id&&!active)return json({message:'自分自身を利用停止にはできません。'},400,cors);
  const rows=await serviceRows<{id:string;organization_id:string;office_id:string;role:Role}>(`/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}&organization_id=eq.${encodeURIComponent(caller.organization_id)}&select=id,organization_id,office_id,role`);
  const target=rows[0];if(!target)return json({message:'対象の社員が見つかりません。'},404,cors);
  if(caller.role==='office_admin'&&(target.office_id!==caller.office_id||target.role!=='employee'))return json({message:'この社員を変更する権限がありません。'},403,cors);
  const response=await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(profileId)}`,{method:'PATCH',headers:{...serviceHeaders(),Prefer:'return=minimal'},body:JSON.stringify({is_active:active})});
  if(!response.ok)return json({message:'社員情報を更新できませんでした。'},400,cors);
  // The account record is retained. App login and all RLS helpers reject inactive profiles.
  return json({ok:true},200,cors);
}

async function getCaller(auth:string):Promise<Caller|null>{
  if(!auth.startsWith('Bearer ')||!SUPABASE_URL||!SUPABASE_ANON_KEY)return null;
  const userResponse=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:auth}});if(!userResponse.ok)return null;
  const user=await userResponse.json().catch(()=>null) as {id?:string}|null;if(!user?.id)return null;
  const rows=await serviceRows<Caller>(`/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=id,organization_id,office_id,role,is_active`);return rows[0]??null;
}
async function serviceRows<T>(path:string):Promise<T[]>{const response=await fetch(`${SUPABASE_URL}${path}`,{headers:serviceHeaders()});if(!response.ok)return[];return await response.json() as T[];}
function serviceHeaders():Record<string,string>{return{apikey:SERVICE_ROLE_KEY,Authorization:`Bearer ${SERVICE_ROLE_KEY}`,'Content-Type':'application/json'};}
function normalizeEmployeeId(value:string):string{return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');}
function mapProfile(row:Record<string,unknown>){return{id:String(row.id),organizationId:String(row.organization_id),officeId:String(row.office_id),employeeId:String(row.employee_id),displayName:String(row.display_name),phone:String(row.phone??''),flyerContactName:String(row.flyer_contact_name??''),mobilePhone:String(row.mobile_phone??''),role:row.role as Role,isActive:Boolean(row.is_active)};}
function originAllowed(request:Request):boolean{if(!APP_ORIGIN)return true;return(request.headers.get('Origin')??'')===APP_ORIGIN;}
function corsHeaders(request:Request):Record<string,string>{const origin=APP_ORIGIN||request.headers.get('Origin')||'*';return{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function json(body:unknown,status:number,headers:Record<string,string>):Response{return new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});}
