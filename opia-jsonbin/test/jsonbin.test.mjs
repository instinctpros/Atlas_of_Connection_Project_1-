import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStorage} from '../storage.mjs';
test('JSONBin adapter reads and updates a private bin without leaking keys into the payload',async()=>{
 const oldFetch=globalThis.fetch;
 process.env.JSONBIN_BIN_ID='testbin';process.env.JSONBIN_ACCESS_KEY='test-secret';
 let record={stars:[]},calls=[];
 globalThis.fetch=async(url,options)=>{
   calls.push({url,options});assert.equal(options.headers['X-Access-Key'],'test-secret');
   if(options.method==='PUT')record=JSON.parse(options.body);
   return {ok:true,json:async()=>({record:structuredClone(record)})};
 };
 try{
   const storage=await createStorage('/tmp/unused-opia.json');assert.equal(storage.kind,'JSONBin');
   assert.deepEqual(await storage.read(),{stars:[]});
   await storage.write({stars:[{id:'a',truth:'A shared sentence.'}]});
   assert.equal((await storage.read()).stars[0].truth,'A shared sentence.');
   assert.ok(calls[0].url.endsWith('/testbin/latest'));assert.equal(calls[1].options.method,'PUT');
   assert.ok(!calls[1].options.body.includes('test-secret'));
   await assert.rejects(storage.write({stars:[{truth:'x'.repeat(100000)}]}),/nearly full/);
   globalThis.fetch=async()=>({ok:false,status:403});await assert.rejects(storage.read(),/403/);
 }finally{globalThis.fetch=oldFetch;delete process.env.JSONBIN_BIN_ID;delete process.env.JSONBIN_ACCESS_KEY;}
});
