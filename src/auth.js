import {db,json,hashText,randomToken,cookie,getCookie,currentUser,requireOrigin} from "./database.js";

async function passwordHash(password, salt=randomToken(16)) {
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:310000,hash:"SHA-256"},key,256);
  const digest=[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return `pbkdf2_sha256$310000$${salt}$${digest}`;
}
async function verifyPassword(password, stored) {
  const [scheme,iterations,salt,digest]=String(stored).split("$");
  if(scheme!=="pbkdf2_sha256" || !iterations || !salt || !digest) return false;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:Number(iterations),hash:"SHA-256"},key,256);
  const actual=[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("");
  return actual===digest;
}
const usernameOk=u=>typeof u==="string" && /^[A-Za-z0-9_]{3,20}$/.test(u);
const passOk=p=>typeof p==="string" && p.length>=10 && p.length<=256;

export async function authRoutes(request,env,path) {
  const ip=request.headers.get("CF-Connecting-IP")||"unknown";
  if(["/api/auth/register","/api/auth/login"].includes(path) && request.method==="POST" && env.AUTH_LIMITER){
    const limit=await env.AUTH_LIMITER.limit({key:ip});
    if(!limit.success) return json({error:"Too many authentication requests. Try again in a minute."},429);
  }
  if(path==="/api/auth/register" && request.method==="POST"){
    requireOrigin(request,env);
    const body=await request.json().catch(()=>null);
    if(!body || !usernameOk(body.username) || !passOk(body.password) || body.password!==body.confirmPassword)
      return json({error:"Use a 3–20 character username (letters, numbers, underscore), password of 10+ chars, and matching confirmation."},400);
    const existing=await db(env,`profiles?username_lower=eq.${encodeURIComponent(body.username.toLowerCase())}&select=id`);
    if(existing.length) return json({error:"Username is already taken."},409);
    const hashed=await passwordHash(body.password);
    let user;
    try { user=(await db(env,"profiles",{method:"POST",body:JSON.stringify({username:body.username,password_hash:hashed})}))[0]; }
    catch(e){ return json({error:"Could not create account. Username may already be taken."},409); }
    return await createSession(user,env);
  }
  if(path==="/api/auth/login" && request.method==="POST"){
    requireOrigin(request,env);
    const body=await request.json().catch(()=>null);
    if(!body || typeof body.username!=="string" || typeof body.password!=="string") return json({error:"Username and password required."},400);
    const rows=await db(env,`profiles?username_lower=eq.${encodeURIComponent(body.username.toLowerCase())}&select=id,username,password_hash,created_at`);
    if(!rows.length || !(await verifyPassword(body.password,rows[0].password_hash))) return json({error:"Invalid username or password."},401);
    const {password_hash,...user}=rows[0];
    return await createSession(user,env);
  }
  if(path==="/api/auth/logout" && request.method==="POST"){
    requireOrigin(request,env);
    const token=getCookie(request,"ct_session");
    if(token) await db(env,`sessions?token_hash=eq.${await hashText(token)}`,{method:"DELETE",prefer:"return=minimal"});
    return json({ok:true},200,{"Set-Cookie":cookie("ct_session","",0)});
  }
  if(path==="/api/auth/me" && request.method==="GET"){
    const user=await currentUser(request,env);
    return json({user:user||null});
  }
  return null;
}
async function createSession(user,env){
  const token=randomToken(32), tokenHash=await hashText(token);
  const expires=new Date(Date.now()+30*24*60*60*1000).toISOString();
  await db(env,"sessions",{method:"POST",body:JSON.stringify({user_id:user.id,token_hash:tokenHash,expires_at:expires})});
  const {password_hash,...safeUser}=user;
  return json({user:safeUser},{headers:{"Set-Cookie":cookie("ct_session",token,30*24*60*60)}});
}
