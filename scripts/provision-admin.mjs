#!/usr/bin/env node
// Creates the first Supabase Auth user + profiles row. Secrets are read from environment only.
const required=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','ADMIN_EMPLOYEE_ID','ADMIN_PASSWORD','ADMIN_DISPLAY_NAME'];
const missing=required.filter((key)=>!process.env[key]);
if(missing.length){console.error(`Missing environment variables: ${missing.join(', ')}`);process.exit(1);}
const base=process.env.SUPABASE_URL.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
const employeeId=normalize(process.env.ADMIN_EMPLOYEE_ID);
const password=process.env.ADMIN_PASSWORD;
const displayName=process.env.ADMIN_DISPLAY_NAME.trim();
const phone=(process.env.ADMIN_PHONE??'').trim();
const domain=process.env.AUTH_EMAIL_DOMAIN??'auth.taiyo-silver.internal';
const organizationId=process.env.ORGANIZATION_ID??'00000000-0000-4000-8000-000000000001';
const officeId=process.env.OFFICE_ID??'00000000-0000-4000-8000-000000000002';
if(!employeeId||password.length<8||!displayName){console.error('ADMIN_EMPLOYEE_ID / ADMIN_DISPLAY_NAME and a password of at least 8 characters are required.');process.exit(1);}
const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
const email=`${employeeId}@${domain}`;
let userId='';
try{
  const auth=await fetch(`${base}/auth/v1/admin/users`,{method:'POST',headers,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{employee_id:employeeId,display_name:displayName}})});
  const payload=await auth.json().catch(()=>({}));
  if(!auth.ok||!payload.id)throw new Error('Could not create the initial Auth user. The employee ID may already exist.');
  userId=payload.id;
  const profile={id:userId,organization_id:organizationId,office_id:officeId,employee_id:employeeId,display_name:displayName,phone,flyer_contact_name:displayName,mobile_phone:phone,role:'org_admin',is_active:true};
  const saved=await fetch(`${base}/rest/v1/profiles`,{method:'POST',headers:{...headers,Prefer:'return=minimal'},body:JSON.stringify(profile)});
  if(!saved.ok)throw new Error('Auth user was created, but the profile row could not be created.');
  console.log(`Initial organization administrator created for employee ID ${employeeId}.`);
}catch(error){
  if(userId)await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(userId)}`,{method:'DELETE',headers}).catch(()=>{});
  console.error(error instanceof Error?error.message:'Provisioning failed.');process.exit(1);
}
function normalize(value){return String(value??'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');}
