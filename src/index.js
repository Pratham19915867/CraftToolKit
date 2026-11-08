import {json} from "./database.js";
import {authRoutes} from "./auth.js";
import {templateRoutes} from "./templates.js";
import {scriptRoutes} from "./scripts.js";
import {aiRoute} from "./ai.js";

export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url), path=url.pathname;
  if(path.startsWith("/api/")){
    try{
      if(path==="/api/health" && request.method==="GET") return json({ok:true,service:"CraftToolkit",timestamp:new Date().toISOString()});
      const auth=await authRoutes(request,env,path); if(auth) return auth;
      const templ=templateRoutes(request,path); if(templ) return templ;
      const scripts=await scriptRoutes(request,env,path); if(scripts) return scripts;
      const ai=await aiRoute(request,env,path); if(ai) return ai;
      return json({error:"API route not found"},404);
    }catch(e){
      console.error("API error",e);
      return json({error:"Internal server error"},500);
    }
  }
  return env.ASSETS.fetch(request);
 }
};
