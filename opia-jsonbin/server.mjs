// A small prototype API using Node's built-in modules. No packages required.
import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import {existsSync} from 'node:fs';
import {createStorage} from './storage.mjs';
const root=dirname(fileURLToPath(import.meta.url));
if(existsSync(join(root,'.env')))process.loadEnvFile(join(root,'.env'));
const publicRoot=join(root,'public');
const storePath=process.env.OPIA_STORE || join(root,'storage','galaxy.json');
const port=Number(process.env.PORT||3000);
const hash=value=>createHash('sha256').update(value).digest('hex');
const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const feelings=new Set(['lonely','numb','anxious','grieving','hopeful','connected','something else']);
const ages=new Set(['18–29','30–39','40–49','50–59','60+','Prefer not to say']);
const storage=await createStorage(storePath);
let db=await storage.read();
if(!Array.isArray(db.stars))throw Error('Invalid galaxy storage');
let lastRead=Date.now();
async function refreshStore(force=false){
  if(force||Date.now()-lastRead>60000){const latest=await storage.read();db=latest;lastRead=Date.now();}
}
let queue=Promise.resolve();
const mutate=fn=>{const job=queue.then(async()=>{
  await refreshStore(true);
  const draft=structuredClone(db);const result=fn(draft);
  await storage.write(draft);db=draft;lastRead=Date.now();return result;
});queue=job.catch(()=>{});return job;};
function visible(star){return {
  id:star.id,alias:star.alias,city:star.city,country:star.country,age:star.age,feeling:star.feeling,truth:star.truth,
  createdAt:star.createdAt,resonances:star.resonators.length,
  replies:star.replies.map(r=>({id:r.id,alias:r.alias,text:r.text,createdAt:r.createdAt}))
};}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data));}
async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000)throw Object.assign(Error('Message too large'),{status:413});}try{return JSON.parse(raw||'{}');}catch{throw Object.assign(Error('Invalid message'),{status:400});}}
function fail(status,message){throw Object.assign(Error(message),{status});}
const rateWindows=new Map();
function limit(req){const key=req.socket.remoteAddress||'unknown';const now=Date.now();let r=rateWindows.get(key);if(!r||now-r.start>60000){r={start:now,count:0};rateWindows.set(key,r);}if(++r.count>60)fail(429,'A little too quickly. Please wait a moment.');if(rateWindows.size>10000)rateWindows.clear();}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')){
      const origin=req.headers.origin;
      const sameOrigin=!origin||new URL(origin).host===req.headers.host;
      const allowedOrigin=origin&&origin===process.env.OPIA_ALLOWED_ORIGIN;
      if(!sameOrigin&&!allowedOrigin)fail(403,'This request must come from OPIA.');
      if(allowedOrigin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Opia-Token');res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');}
      if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
      await queue;
      await refreshStore();
      if(req.method!=='GET'){
        limit(req);

      }
      const cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('opia_identity='))?.slice(14)||'';
      const clientToken=req.headers['x-opia-token'];
      if(clientToken&&!/^[a-f0-9]{64}$/.test(clientToken))fail(400,'Invalid visitor identity.');
      const identity=clientToken||cookie;
      const ownerHash=identity?hash(identity):null;
      const mine=db.stars.find(s=>s.ownerHash===ownerHash);
      if(url.pathname==='/api/stars'&&req.method==='GET')return json(res,200,{stars:db.stars.map(visible),ownStarId:mine?.id||null});
      if(url.pathname==='/api/stars'&&req.method==='POST'){
        const data=await body(req);const truth=text(data.truth,180),city=text(data.city,60),country=text(data.country,60);
        if(!truth||!city||!country)fail(400,'Add a city, country, and one true sentence.');
        if(!feelings.has(data.feeling)||!ages.has(data.age))fail(400,'Choose an age group and feeling from the form.');
        const token=identity||randomBytes(32).toString('hex');
        const star=await mutate(draft=>{
          const previous=draft.stars.find(s=>s.ownerHash===hash(token));
          const star=previous||{id:randomUUID(),ownerHash:hash(token),createdAt:new Date().toISOString(),replies:[],resonators:[]};
          Object.assign(star,{alias:text(data.alias,30)||'A fellow star',truth,city,country,age:data.age,feeling:data.feeling,
            connectivity:Math.max(0,Math.min(100,Number(data.connectivity)||0)),
            demographics:Object.fromEntries(['age','identity','race','income','place'].map(k=>[k,text(data.demographics?.[k],60)]))});
          if(!previous)draft.stars.push(star);return visible(star);
        });
        return json(res,200,{star},{'Set-Cookie':`opia_identity=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${req.socket.encrypted||req.headers['x-forwarded-proto']==='https'?'; Secure':''}`});
      }
      const match=url.pathname.match(/^\/api\/stars\/([a-zA-Z0-9-]+)(?:\/(replies|resonate))?$/);
      if(match){
        if(!mine)fail(401,'Create your star first to leave a response.');
        const id=match[1];const action=match[2];const data=req.method==='POST'?await body(req):{};
        const result=await mutate(draft=>{
          const star=draft.stars.find(s=>s.id===id);if(!star)fail(404,'That star is no longer here.');
          if(req.method==='DELETE'&&!action){
            if(star.ownerHash!==ownerHash)fail(403,'You can only remove your own star.');
            draft.stars=draft.stars.filter(s=>s.id!==id);return {removed:true};
          }
          if(req.method!=='POST')fail(405,'Action not supported.');
          if(action==='replies'){
            const reply=text(data.text,240);if(!reply)fail(400,'Write a little kindness first.');
            if(star.replies.length>=100)fail(400,'This star has reached its prototype reply limit.');
            star.replies.push({id:randomUUID(),authorId:mine.id,alias:mine.alias,text:reply,createdAt:new Date().toISOString()});
          }else if(action==='resonate'){
            if(!star.resonators.includes(mine.id))star.resonators.push(mine.id);
          }else fail(404,'Action not found.');
          return {star:visible(star)};
        });return json(res,200,result);
      }
      return json(res,404,{error:'API route not found.'});
    }
    if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Method not allowed'});
    const requested=decodeURIComponent(url.pathname)==='/'?'/index.html':decodeURIComponent(url.pathname);
    const path=resolve(publicRoot,'.'+requested);
    if(!path.startsWith(publicRoot+'/'))return json(res,403,{error:'Not allowed'});
    const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg'};
    const file=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:file);
  }catch(error){if(error.code==='ENOENT')return json(res,404,{error:'File not found'});if(!error.status)console.error('OPIA request failed:',error.message);json(res,error.status||500,{error:error.status?error.message:'Could not save right now. Your words are still in the form. Try again.'});}
});
server.listen(port,'0.0.0.0',()=>console.log(`OPIA (${storage.kind}) is ready at http://localhost:${server.address().port}`));
