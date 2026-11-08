export async function db(env, path, options = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase secrets are not configured");
  const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {})
    }
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase error (${res.status}): ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : [];
}
export const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store", ...headers }
});
export async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
export function randomToken(n=32) {
  const b=crypto.getRandomValues(new Uint8Array(n));
  return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}
export function cookie(name,value,maxAge) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
export function getCookie(request,name) {
  return (request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1) || null;
}
export async function currentUser(request, env) {
  const token=getCookie(request,"ct_session");
  if(!token) return null;
  const tokenHash=await hashText(token);
  const rows=await db(env,`sessions?token_hash=eq.${tokenHash}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user_id`);
  if(!rows.length) return null;
  const users=await db(env,`profiles?id=eq.${rows[0].user_id}&select=id,username,created_at`);
  return users[0]||null;
}
export function requireOrigin(request, env) {
  const origin=request.headers.get("Origin");
  if(origin && env.APP_ORIGIN && origin !== env.APP_ORIGIN) throw new Error("Origin not allowed");
}
