import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'opia-test-'));
let server,base;
async function start(){server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:'0',OPIA_ALLOWED_ORIGIN:'https://instinctpros.github.io',OPIA_STORE:join(dir,'galaxy.json')},cwd:new URL('../',import.meta.url)});base=await new Promise((resolve,reject)=>{server.stdout.on('data',s=>{const m=String(s).match(/http:\/\/localhost:\d+/);if(m)resolve(m[0]);});server.on('error',reject);server.on('exit',code=>reject(Error('Server exited '+code)));});}
async function stop(){await new Promise(resolve=>{server.on('exit',resolve);server.kill();});}
async function api(path,method='GET',data=null,cookie=''){const res=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:data?JSON.stringify(data):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
const payload=alias=>({alias,city:'New York',country:'United States',age:'40–49',feeling:'hopeful',truth:'I am learning to begin again.',connectivity:60,demographics:{identity:'Women',race:'Black',income:'Under $25K'}});
test('Shared stars, private metadata, replies, ownership, idempotent reactions and restart persistence',async()=>{
  try{await start();
    const one=await api('stars','POST',payload('One'));assert.equal(one.status,200);assert.ok(one.cookie);
    const two=await api('stars','POST',payload('Two'));assert.equal(two.status,200);
    const list=await api('stars','GET',null,one.cookie);assert.equal(list.data.stars.length,2);assert.equal(list.data.ownStarId,one.data.star.id);assert.equal(list.data.stars[0].demographics,undefined);assert.equal(list.data.stars[0].ownerHash,undefined);
    const reply=await api(`stars/${one.data.star.id}/replies`,'POST',{text:'I hear you.'},two.cookie);assert.equal(reply.status,200);assert.equal(reply.data.star.replies[0].alias,'Two');
    await api(`stars/${one.data.star.id}/resonate`,'POST',{},two.cookie);
    const again=await api(`stars/${one.data.star.id}/resonate`,'POST',{},two.cookie);assert.equal(again.data.star.resonances,1);
    const forbidden=await api(`stars/${one.data.star.id}`,'DELETE',null,two.cookie);assert.equal(forbidden.status,403);
    const updated=await api('stars','POST',{...payload('One'),'truth':'My updated truth.'},one.cookie);assert.equal(updated.data.star.id,one.data.star.id);
    await stop();await start();
    const restored=await api('stars','GET',null,one.cookie);assert.equal(restored.data.ownStarId,one.data.star.id);assert.equal(restored.data.stars.find(s=>s.id===one.data.star.id).replies.length,1);
    assert.equal((await api('stars','POST',{truth:''})).status,400);
    assert.equal((await api(`stars/${two.data.star.id}/replies`,'POST',{text:'Anonymous'})).status,401);
    await api(`stars/${one.data.star.id}`,'DELETE',null,one.cookie);assert.equal((await api('stars')).data.stars.length,1);
    const preflight=await fetch(base+'/api/stars',{method:'OPTIONS',headers:{Origin:'https://instinctpros.github.io','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'X-Opia-Token, Content-Type'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://instinctpros.github.io');
    const clientToken='a'.repeat(64);
    const cross=await fetch(base+'/api/stars',{method:'POST',headers:{Origin:'https://instinctpros.github.io','Content-Type':'application/json','X-Opia-Token':clientToken},body:JSON.stringify(payload('GitHub visitor'))});assert.equal(cross.status,200);
    const crossStar=await cross.json();
    const returning=await fetch(base+'/api/stars',{headers:{Origin:'https://instinctpros.github.io','X-Opia-Token':clientToken}});assert.equal((await returning.json()).ownStarId,crossStar.star.id);
    const untrusted=await fetch(base+'/api/stars',{headers:{Origin:'https://unrelated.example'}});assert.equal(untrusted.status,403);
  }finally{if(server&&!server.killed)await stop();await rm(dir,{recursive:true,force:true});}
});
