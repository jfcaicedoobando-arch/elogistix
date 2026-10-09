const assert=require('node:assert/strict');
const sig='public.seguro_facturas_elegibles(uuid,numeric,text,uuid,integer,date,uuid)';
function variants(installer) {
  assert.equal((installer.match(/_selector148_enabled CONSTANT boolean := false;/g)||[]).length,1);
  assert.equal((installer.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((installer.match(/^COMMIT;$/gm)||[]).length,1);
  const ddl=installer.indexOf('ALTER TABLE public.conceptos_costo');
  const guard=installer.indexOf('DO $integrity148$');
  const fn=installer.indexOf('CREATE OR REPLACE FUNCTION public.seguro_facturas_elegibles(');
  assert(ddl>0 && guard>ddl && fn>guard);
  const grant='GRANT EXECUTE ON FUNCTION '+sig+' TO authenticated;\n';
  function enabled(sql) {
    const result=sql.replace('_selector148_enabled CONSTANT boolean := false;','_selector148_enabled CONSTANT boolean := true;')
      .replace(/^COMMIT;$/m,grant+'COMMIT;');
    assert.equal(result.replace(grant,'').replace('_selector148_enabled CONSTANT boolean := true;','_selector148_enabled CONSTANT boolean := false;'),sql);
    return result;
  }
  return {
    installEnabled:enabled(installer),
    enableSql:enabled(installer.slice(0,ddl)+installer.slice(guard)),
    disabledFunctionSql:'BEGIN;\n'+installer.slice(fn)
  };
}
module.exports={sig,variants};
