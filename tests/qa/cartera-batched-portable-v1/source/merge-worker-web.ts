import {mergeBatchPdfs} from './merge-portable';
self.onmessage=async({data:{id,batches,font}})=>{try{const result=await mergeBatchPdfs(batches,font);self.postMessage({id,ok:true,...result},{transfer:[result.bytes.buffer]});}catch(error){self.postMessage({id,ok:false,error:String(error)});}};
