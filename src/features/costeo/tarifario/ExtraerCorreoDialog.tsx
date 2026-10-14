/**
 * «Extraer de correo»: lee el buzón de Pricing (Gmail) vía la función
 * extraer-tarifas-correo, convierte los correos de los 4 agentes en filas y
 * reutiliza la validación y el guardado en borrador de la importación
 * CSV/Excel. Nada se guarda sin que el usuario confirme.
 */
import { useState } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchPuertos, fetchNavieras, fetchTiposContenedor } from "@/features/catalogos/services";
import { fetchCosteoAgentes } from "@/features/costeo/services/agentes";
import { fetchCosteoRutas, insertCosteoRuta } from "@/features/costeo/services/rutas";
import { insertTarifaConRecargos, fetchCosteoTarifas } from "@/features/costeo/services/tarifas";
import { detectarConflictos, seleccionInicial, type Conflicto } from "./duplicadosTarifas";
import { ConflictosTarifasLista } from "./ConflictosTarifasLista";
import { hoyMx } from "@/lib/date/mx";
import { prepararImportacion, type ResultadoImport } from "./importarTarifas";
import { parsearCorreoProveedor, type CorreoDescargado } from "./correo/parsearCorreoTarifas";
import { AGENTE_CLAVE, NOMBRE_PROVEEDOR, type ProveedorCorreo } from "./correo/proveedoresCorreo";
import type { FilaCorreo } from "./correo/comun";
import { faltantesDeCatalogo, type Faltantes } from "./correo/faltantesCatalogo";
import { PendientesAltaSeccion } from "./AltaFaltantesPanel";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

interface Estado {
  prep: ResultadoImport;
  resumen: { proveedor: string; filas: number }[];
  conflictos: Conflicto[];
}

export function ExtraerCorreoDialog({ open, onOpenChange, onDone }: Props) {
  const { organizationId } = useOrganization();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
  const [resultado, setResultado] = useState<{ creadas: number; errores: string[] } | null>(null);
  const [faltantes, setFaltantes] = useState<Faltantes | null>(null);
  const [altasHechas, setAltasHechas] = useState(0);

  /** Valida filas contra catálogos frescos y detecta duplicados y faltantes. */
  const preparar = async (filas: FilaCorreo[], erroresBase: string[], resumen: Estado["resumen"]) => {
    if (!organizationId) return;
    const [puertos, agentes, navieras, tipos, rutas] = await Promise.all([
      fetchPuertos(), fetchCosteoAgentes(organizationId), fetchNavieras(), fetchTiposContenedor(), fetchCosteoRutas(organizationId),
    ]);
    const existentes = await fetchCosteoTarifas(organizationId, { estado: "todas" });
    const prep = prepararImportacion(filas as unknown as Record<string, unknown>[], { puertos, agentes, navieras, tipos, rutas });
    const conflictos = detectarConflictos(prep.tarifas, existentes, rutas, hoyMx());
    const f = faltantesDeCatalogo(filas, { puertos, navieras });
    setFaltantes(f.pendientes.length ? f : null); setAltasHechas(0);
    setSeleccion(seleccionInicial(prep.tarifas.length, conflictos));
    setEstado({ prep: { tarifas: prep.tarifas, errores: [...erroresBase, ...prep.errores] }, resumen, conflictos });
  };

  const prepararPendientes = async () => {
    if (!faltantes) return;
    setCargando(true); setResultado(null);
    try { await preparar(faltantes.pendientes, [], [{ proveedor: "Tarifas pendientes de alta", filas: faltantes.pendientes.length }]); }
    finally { setCargando(false); }
  };

  const extraer = async () => {
    if (!organizationId) return;
    setCargando(true); setResultado(null); setEstado(null);
    try {
      const { data, error } = await supabase.functions.invoke("extraer-tarifas-correo", { body: { organizationId } });
      if (error) throw new Error(msg(error));
      const correos = (data as { correos: CorreoDescargado[] }).correos ?? [];
      const agentes = await fetchCosteoAgentes(organizationId);
      const filas: FilaCorreo[] = [];
      const errores: string[] = [];
      const resumen: Estado["resumen"] = [];
      for (const c of correos) {
        const r = await parsearCorreoProveedor(c, hoyMx());
        const clave = AGENTE_CLAVE[c.proveedor as ProveedorCorreo];
        const agente = agentes.find((a) => norm(a.nombre).includes(norm(clave ?? "")));
        for (const f of r.filas) filas.push({ ...f, Agente: agente?.nombre ?? clave ?? f.Agente });
        errores.push(...r.errores);
        resumen.push({ proveedor: NOMBRE_PROVEEDOR[c.proveedor as ProveedorCorreo] ?? c.proveedor, filas: r.filas.length });
      }
      await preparar(filas, errores, resumen);
    } catch (e) {
      setEstado({ prep: { tarifas: [], errores: [`No se pudieron leer los correos: ${msg(e)}`] }, resumen: [], conflictos: [] });
    } finally { setCargando(false); }
  };

  const importar = async () => {
    if (!estado || !organizationId) return;
    setCargando(true);
    const rutas = new Map<string, string>();
    const errores: string[] = [];
    let creadas = 0;
    for (const t of estado.prep.tarifas.filter((_, i) => seleccion.has(i))) {
      try {
        let rutaId = t.input.ruta_id;
        if (!rutaId) {
          const k = `${t.origenId}>${t.destinoId}`;
          rutaId = rutas.get(k) ?? (await insertCosteoRuta(organizationId, { puerto_origen_id: t.origenId, puerto_destino_id: t.destinoId })).id;
          rutas.set(k, rutaId);
        }
        await insertTarifaConRecargos(organizationId, { ...t.input, ruta_id: rutaId });
        creadas += 1;
      } catch (e) { errores.push(`Fila ${t.fila}: ${msg(e)}`); }
    }
    setResultado({ creadas, errores }); setEstado(null); setCargando(false);
    if (creadas > 0) onDone();
  };

  const cerrar = (v: boolean) => { if (!v) { setEstado(null); setResultado(null); setFaltantes(null); } onOpenChange(v); };
  const mostrarAltas = Boolean(resultado) || estado?.prep.tarifas.length === 0;
  const errores = resultado?.errores ?? estado?.prep.errores ?? [];
  const footer = (
    <>
      <Button variant="outline" onClick={() => cerrar(false)}>Cerrar</Button>
      {!estado && !resultado && (
        <Button onClick={() => void extraer()} disabled={cargando}>{cargando ? "Leyendo correos…" : "Buscar tarifas en el correo"}</Button>
      )}
      {estado && estado.prep.tarifas.length > 0 && (
        <Button onClick={() => void importar()} disabled={cargando || seleccion.size === 0}>
          {cargando ? "Guardando…" : `Cargar ${seleccion.size} tarifa(s) en borrador`}
        </Button>
      )}
    </>
  );

  return (
    <FormDialogShell open={open} onOpenChange={cerrar} icon={Mail} title="Extraer de correo"
      description="Lee el correo más reciente de cada agente (Longsail, Golden, Oriental y Rainbow) y prepara las tarifas. Entran en borrador hasta aprobarse, igual que al capturarlas a mano."
      size="lg" footer={footer}>
      <div className="space-y-3 text-body-sm">
        {cargando && !estado && <p>Buscando correos de los 4 agentes…</p>}
        {estado && (
          <>
            <ul className="list-disc pl-5">
              {estado.resumen.map((r) => <li key={r.proveedor}>{r.proveedor}: {r.filas} renglón(es) leído(s)</li>)}
            </ul>
            <p>Listas para cargar: <strong>{estado.prep.tarifas.length}</strong> tarifa(s). Renglones con error: <strong>{estado.prep.errores.length}</strong> (se omiten).</p>
            <ConflictosTarifasLista tarifas={estado.prep.tarifas} conflictos={estado.conflictos} seleccion={seleccion}
              onToggle={(i, v) => setSeleccion((s) => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n; })} />
          </>
        )}
        {resultado && <p>Se cargaron <strong>{resultado.creadas}</strong> tarifa(s) en borrador.</p>}
        {mostrarAltas && faltantes && (
          <PendientesAltaSeccion faltantes={faltantes} altasHechas={altasHechas} cargando={cargando}
            onAltas={setAltasHechas} onPreparar={() => void prepararPendientes()} />
        )}
        {errores.length > 0 && (
          <ul className="max-h-48 list-disc space-y-1 overflow-auto rounded-md border p-3 pl-6 text-destructive">
            {errores.slice(0, 100).map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
    </FormDialogShell>
  );
}
