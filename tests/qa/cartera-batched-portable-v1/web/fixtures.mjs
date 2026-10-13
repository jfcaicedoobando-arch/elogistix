export function regularFixture(count) {
 const rows=Array.from({length:count},(_,i)=>({contraparte:'Proveedor de servicios logísticos internacionales con nombre extenso',folio:`QA-${String(i+1).padStart(5,'0')}`,expediente:`EX${String(i+1).padStart(6,'0')}`,vencimiento:'12/10/2026',dias:'1',bucket:'1-30 días',moneda:'USD',saldo:'95.00',mxnHistorico:'1900.00',mxnCorte:'1720.72',diferencia:'-179.28'}));
 const totals=(title,n)=>['Vigente','1-30 días','31-60 días','61-90 días','+90 días',`Total ${title}`].map((etiqueta,i)=>({etiqueta,conteo:String(i===1||i===5?n:0),mxnHistorico:String(i===1||i===5?1900*n:0),mxnCorte:String(i===1||i===5?1720.72*n:0),diferencia:String(i===1||i===5?-179.28*n:0)}));
 return {fechaCorte:'2026-10-12',leyendaTc:'TC DOF USD/MXN 18.1128 (publicado el día del corte)',emisor:{organizacionNombre:'Empresa sintética QA'},generatedAt:'2026-10-13T06:48:42.827Z',bloques:[{titulo:'Cuentas por cobrar',totales:totals('Cuentas por cobrar',0),facturas:[]},{titulo:'Cuentas por pagar',totales:totals('Cuentas por pagar',count),facturas:rows}]};
}
export async function loadFixture(kind,signal) {
 if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
 if(kind!=='mixed')return regularFixture(Number(kind));
 const response=await fetch('./fixtures/mixed-121.json',{signal});
 if(!response.ok)throw new Error('Unable to load local mock fixture');
 return response.json();
}
