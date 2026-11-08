import {json,currentUser,requireOrigin} from "./database.js";
export async function aiRoute(request,env,path){
  if(path!=="/api/ai/generate" || request.method!=="POST") return null;
  const user=await currentUser(request,env);
  if(!user) return json({error:"Authentication required."},401);
  try{requireOrigin(request,env);}catch(e){return json({error:e.message},403);}
  if(env.AI_LIMITER){
    const limit=await env.AI_LIMITER.limit({key:request.headers.get("CF-Connecting-IP")||user.id});
    if(!limit.success) return json({error:"AI request limit reached. Try again in a minute."},429);
  }
  if(!env.AI_API_KEY) return json({error:"AI provider is not configured. Set AI_API_KEY in Worker secrets."},503);
  const b=await request.json().catch(()=>null);
  if(!b || typeof b.prompt!=="string" || b.prompt.trim().length<8 || b.prompt.length>4000)
    return json({error:"Describe the feature in 8–4000 characters."},400);
  const mc=String(b.minecraftVersion||"1.20.4").slice(0,30), sk=String(b.skriptVersion||"2.8+").slice(0,30);
  const deps=Array.isArray(b.dependencies)?b.dependencies.slice(0,30).map(x=>String(x).slice(0,80)).join(", "):"Skript only";
  const endpoint=(env.AI_BASE_URL||"https://api.openai.com/v1").replace(/\/$/,"")+"/chat/completions";
  const res=await fetch(endpoint,{method:"POST",headers:{"Authorization":`Bearer ${env.AI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({
    model:env.AI_MODEL||"gpt-4o-mini",temperature:0.2,max_tokens:5000,
    messages:[
      {role:"system",content:"You are an expert Minecraft Skript developer. Return ONLY complete Skript source code, no Markdown fences or prose. Use standard Skript syntax unless dependencies are explicitly listed. Avoid destructive/admin actions unless requested. If a requirement is ambiguous, make safe assumptions and put comments in code. Code may need testing; do not guarantee compatibility."},
      {role:"user",content:`Generate a complete .sk file for: ${b.prompt}\nMinecraft: ${mc}\nSkript: ${sk}\nInstalled dependencies: ${deps}\nUse compatible syntax and include comments where necessary.`}
    ]
  })});
  if(!res.ok){const t=await res.text();return json({error:`AI provider returned ${res.status}: ${t.slice(0,300)}`},502);}
  const data=await res.json();
  const code=data.choices?.[0]?.message?.content?.trim();
  if(!code) return json({error:"AI returned an empty response."},502);
  return json({code:code.replace(/^```(?:skript|sk)?\s*/i,"").replace(/\s*```$/,""),warning:"Generated code is not guaranteed to work. Test on a backup server first."});
}
