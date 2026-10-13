import { renderBatch } from './render-portable';
self.onmessage = async ({data:{id,props}}) => {
  try { const bytes = await renderBatch(props); self.postMessage({id,ok:true,bytes},{transfer:[bytes.buffer]}); }
  catch(error) { self.postMessage({id,ok:false,error:String(error)}); }
};
