"""Extract actual canonical definitions, never copy an approximation of the guards."""
from pathlib import Path
import re
import sys
root = Path(__file__).resolve().parents[3]
sources = [
    ('20261006213000_replay_audit144_nc_linaje.sql', '_nc_factor_moneda_factura'),
    ('20261008143000_replay_audit144_nc_identidad.sql', '_nc_validar_linaje_conceptos'),
    ('20260718213500_db6fd761-d398-471d-93d3-cd6c71e1143e.sql', 'assert_factura_viva_para_rep'),
    ('20260717000021_1892efbe-7933-428a-aec9-54371844d0c3.sql', 'duplicar_factura_para_sustitucion'),
]
out = []
for filename, name in sources:
    text = (root / 'supabase/migrations' / filename).read_text()
    match = re.search(r'CREATE OR REPLACE FUNCTION public\.' + name + r'\([\s\S]*?AS (\$\w*\$)[\s\S]*?\1;', text, re.I)
    if not match:
        raise RuntimeError(f'Missing canonical function: {name}')
    out.append(match.group(0))
    if len(sys.argv) > 2 and name == sys.argv[2]:
        Path(sys.argv[1]).write_text(match.group(0) + '\n')
        raise SystemExit(0)
out += [
    'CREATE TRIGGER trg_nc_validar_linaje_conceptos BEFORE INSERT OR UPDATE OF conceptos, factura_id, moneda, tipo_cambio ON public.factura_notas_credito FOR EACH ROW EXECUTE FUNCTION public._nc_validar_linaje_conceptos();',
    'CREATE TRIGGER trg_pago_factura_rep_viva BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id ON public.pagos_factura FOR EACH ROW WHEN (NEW.uuid_rep IS NOT NULL OR NEW.facturapi_rep_id IS NOT NULL) EXECUTE FUNCTION public.assert_factura_viva_para_rep();',
    "CREATE TEMP TABLE function_metadata AS SELECT oid, proname, proowner, proacl, prosecdef, proconfig, prorettype FROM pg_proc WHERE oid IN ('public._nc_validar_linaje_conceptos()'::regprocedure, 'public.assert_factura_viva_para_rep()'::regprocedure, 'public.duplicar_factura_para_sustitucion(uuid)'::regprocedure);",
]
Path(sys.argv[1]).write_text('\n\n'.join(out) + '\n')
