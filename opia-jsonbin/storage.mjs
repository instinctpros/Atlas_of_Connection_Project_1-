// Storage adapter. JSONBin credentials stay on the server.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
export async function createStorage(localPath) {
  const binId=process.env.JSONBIN_BIN_ID;
  const accessKey=process.env.JSONBIN_ACCESS_KEY;
  if(!binId&&!accessKey){
    await mkdir(dirname(localPath),{recursive:true});
    return {
      kind:'local file',
      async read(){try{return JSON.parse(await readFile(localPath,'utf8'));}catch(e){if(e.code==='ENOENT')return {stars:[]};throw e;}},
      async write(data){await writeFile(localPath+'.tmp',JSON.stringify(data,null,2),{mode:0o600});await rename(localPath+'.tmp',localPath);}
    };
  }
  if(!binId||!accessKey)throw Error('Set both JSONBIN_BIN_ID and JSONBIN_ACCESS_KEY in the backend environment.');
  if(!/^[a-zA-Z0-9_-]+$/.test(binId))throw Error('JSONBIN_BIN_ID must be the bin ID, not the full URL.');
  const url=(process.env.JSONBIN_API_URL||'https://api.jsonbin.io/v3/b')+'/'+binId;
  async function request(suffix,method,data){
    const response=await fetch(url+suffix,{
      method,signal:AbortSignal.timeout(12000),
      headers:{'Content-Type':'application/json','X-Access-Key':accessKey,'X-Bin-Versioning':'false'},
      body:data?JSON.stringify(data):undefined
    });
    if(!response.ok)throw Error(`JSONBin returned ${response.status}. Check the bin ID, access-key permissions, and request allowance.`);
    const result=await response.json();return result.record;
  }
  return {
    kind:'JSONBin',
    async read(){const data=await request('/latest','GET');if(!data||!Array.isArray(data.stars))throw Error('Initialize the bin with {"stars":[]}.');return data;},
    async write(data){if(Buffer.byteLength(JSON.stringify(data),'utf8')>95000)throw Error('This prototype bin is nearly full. Export it or increase its storage allowance.');await request('','PUT',data);}
  };
}
