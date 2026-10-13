"""Extract repository function bodies, not test copies of the patched RPCs."""
from pathlib import Path
import os,re,sys
root=Path(__file__).resolve().parents[3]
names={
 'recalc_factura_totales':'supabase/migrations/20261004002600_audit26_factura_redondeo_linea.sql',
 'actualizar_tc_embarque_dof':'supabase/migrations/20260813002657_501446aa-5f51-4b5a-81ca-e0d5d1d1cc81.sql',
 '_assert_writer':'supabase/schema/baseline.sql',
 'tg_bloquear_embarque_cerrado_self':'supabase/schema/baseline.sql',
}
# Targeted replay slice: TC survives unchanged from the checked-in squash, while
# recalc is replaced by the later audit26 migration. This is not full DB replay.
if os.environ.get('BASELINE_SOURCE') == 'replay':
 names['actualizar_tc_embarque_dof']='supabase/schema/squash/baseline_squash_v13_821_0.sql'
out=[]
for name,path in names.items():
 s=(root/path).read_text();m=re.search(r'CREATE (?:OR REPLACE )?FUNCTION public\.'+name+r'\([\s\S]*?AS (\$\w*\$)[\s\S]*?\1;',s,re.I)
 assert m,name
 if len(sys.argv)>2 and name!=sys.argv[2]:continue
 out.append(m.group(0))
if len(sys.argv) == 2:
 out.append('CREATE TRIGGER trg_bloquear_embarque_self BEFORE DELETE OR UPDATE ON public.embarques FOR EACH ROW EXECUTE FUNCTION public.tg_bloquear_embarque_cerrado_self();')
Path(sys.argv[1]).write_text('\n\n'.join(out)+'\n')
