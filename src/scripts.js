import {db,json,currentUser,requireOrigin} from "./database.js";
export async function scriptRoutes(request,env,path){
  if(!path.startsWith("/api/scripts")) return null;
  const user=await currentUser(request,env);
  if(!user) return json({error:"Authentication required."},401);
  if(path==="/api/scripts" && request.method==="GET"){
    const rows=await db(env,`saved_scripts?user_id=eq.${user.id}&select=id,title,filename,code,source,created_at,updated_at&order=created_at.desc`);
    return json({scripts:rows});
  }
  if(path==="/api/scripts" && request.method==="POST"){
    try{requireOrigin(request,env);}catch(e){return json({error:e.message},403);}
    const b=await request.json().catch(()=>null);
    if(!b || typeof b.title!=="string" || typeof b.code!=="string" || b.title.trim().length<1 || b.title.length>100 || b.code.length>100000)
      return json({error:"Valid title and code (up to 100 KB) are required."},400);
    const filename=(typeof b.filename==="string"?b.filename:b.title).replace(/\.sk$/i,"").replace(/[^A-Za-z0-9_-]/g,"_").slice(0,80)+".sk";
    const source=["template","ai","user"].includes(b.source)?b.source:"user";
    const saved=(await db(env,"saved_scripts",{method:"POST",body:JSON.stringify({user_id:user.id,title:b.title.trim(),filename,code:b.code,source})}))[0];
    return json({script:saved},201);
  }
  const match=path.match(/^\/api\/scripts\/([0-9a-f-]{36})$/i);
  if(match && request.method==="DELETE"){
    try{requireOrigin(request,env);}catch(e){return json({error:e.message},403);}
    await db(env,`saved_scripts?id=eq.${match[1]}&user_id=eq.${user.id}`,{method:"DELETE",prefer:"return=minimal"});
    return json({ok:true});
  }
  return json({error:"Not found"},404);
}
