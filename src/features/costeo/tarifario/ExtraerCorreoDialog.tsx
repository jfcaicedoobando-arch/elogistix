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
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchPuertos, fetchNavieras, fetchTiposContenedor } from "@/features/catalogos/services";
import { fetchCosteoRutas } from "@/features/costeo/services/rutas";
import { fetchCosteoTarifas } from "@/features/costeo/services/tarifas";
import { detectarConflictos, seleccionInicial, type Conflicto } from "./duplicadosTarifas";
import { ConflictosTarifasLista } from "./ConflictosTarifasLista";
import { TarifasPorProveedor } from "./TarifasPorProveedor";
import { mapearAgentes } from "./agruparProveedor";
import { hoyMx } from "@/lib/date/mx";
import { prepararImportacion, type ResultadoImport } from "./importarTarifas";
import { guardarSeleccionadas } from "./guardarSeleccionadas";
import { leerCorreos } from "./correo/leerCorreos";
import type { FilaCorreo } from "./correo/comun";
import { ErroresLista, erroresVisibles } from "./ErroresLista";
import { faltantesDeCatalogo, type Faltantes } from "./correo/faltantesCatalogo";
import { PendientesAltaSeccion } from "./AltaFaltantesPanel";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

interface Estado {
  prep: ResultadoImport;
  resumen: { proveedor: string; filas: number }[];
  conflictos: Conflicto[];
  proveedorDe: Map<string, string>;
  nombreAgenteDe: Map<string, string>;
  puertos: Map<string, string>;
  navieras: Map<string, string>;
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
    const { proveedorDe, nombreAgenteDe } = mapearAgentes(agentes);
    setEstado({
      prep: { tarifas: prep.tarifas, errores: [...erroresBase, ...prep.errores] }, resumen, conflictos,
      proveedorDe, nombreAgenteDe,
      puertos: new Map(puertos.map((p): [string, string] => [p.id, p.name])),
      navieras: new Map(navieras.map((n): [string, string] => [n.id, n.name])),
    });
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
      const lectura = await leerCorreos(organizationId);
      await preparar(lectura.filas, lectura.errores, lectura.resumen);
    } catch (e) {
      setEstado({ prep: { tarifas: [], errores: [`No se pudieron leer los correos: ${msg(e)}`] }, resumen: [], conflictos: [], proveedorDe: new Map(), nombreAgenteDe: new Map(), puertos: new Map(), navieras: new Map() });
    } finally { setCargando(false); }
  };

  const importar = async () => {
    if (!estado || !organizationId) return;
    setCargando(true);
    const res = await guardarSeleccionadas(organizationId, seleccion, estado.prep.tarifas);
    setResultado(res); setEstado(null); setCargando(false);
    if (res.creadas > 0) onDone();
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
            <TarifasPorProveedor tarifas={estado.prep.tarifas} proveedorDe={estado.proveedorDe} nombreAgenteDe={estado.nombreAgenteDe}
              puertos={estado.puertos} navieras={estado.navieras} />
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
        <ErroresLista errores={errores} />
      </div>
    </FormDialogShell>
  );
}
