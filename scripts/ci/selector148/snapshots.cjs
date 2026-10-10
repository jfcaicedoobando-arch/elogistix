// Profile the existing serial snapshot contract without changing frozen SQL,
// query order, JSON transport, parsing or complete snapshot evidence.
const sections=Object.freeze(['catalog','procs','relations','columns','structure','roles','effective','triggers','data']);

function createSnapshotter({read,save,profile}) {
  return async function snapshot(q,tag) {
    return profile.async('snapshot.total',async()=>{
      const out={};
      for(const section of sections) {
        if(section==='data')await profile.async('snapshot.data.reset',()=>q.query('DROP FUNCTION IF EXISTS pg_temp.snapshot_data()'));
        const sql=profile.sync('fixture.read.'+section,()=>read('fixtures/'+section+'.sql'));
        let result=await profile.async('snapshot.query.'+section,()=>q.query(sql));
        if(Array.isArray(result))result=result.at(-1);
        const text=result.rows[0].jsonb_pretty;
        out[section]=profile.sync('snapshot.parse.'+section,()=>JSON.parse(text),typeof text==='string'?Buffer.byteLength(text):undefined);
      }
      save('snapshot-'+tag,out);return out;
    });
  };
}
module.exports={sections,createSnapshotter};
