import type { BloqueCarteraPdf } from './src/pdf/documents/ReporteCarteraDocument';
export function planBatches(props:any,size=500) {
  if(!Number.isInteger(size)||size<1)throw new Error('Invalid batch size');
  if(!Array.isArray(props?.bloques)||props.bloques.length===0)throw new Error('At least one report block is required');
  const jobs:any[]=[];
  for(const block of props.bloques as BloqueCarteraPdf[]) {
    const chunks=Math.max(1,Math.ceil(block.facturas.length/size));
    for(let index=0;index<chunks;index++) jobs.push({...props,bloques:[{...block,facturas:block.facturas.slice(index*size,(index+1)*size)}],batchContext:{first:jobs.length===0,continuation:index>0,generatedAt:props.generatedAt}});
  }
  return jobs;
}
