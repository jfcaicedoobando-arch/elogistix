/** Carga masiva de tarifas desde CSV o Excel (mismas columnas que «Descargar Excel»). */
import { useState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { fetchPuertos, fetchNavieras, fetchTiposContenedor } from "@/features/catalogos/services";
import { fetchCosteoAgentes } from "@/features/costeo/services/agentes";
import { fetchCosteoRutas, insertCosteoRuta } from "@/features/costeo/services/rutas";
import { insertTarifaConRecargos } from "@/features/costeo/services/tarifas";
import { prepararImportacion, type ResultadoImport } from "./importarTarifas";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }

async function leerArchivo(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const hoja = wb.Sheets[wb.SheetNames[0]];
  return hoja ? XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja, { defval: "" }) : [];
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

export function ImportarTarifasDialog({ open, onOpenChange, onDone }: Props) {
  const { organizationId } = useOrganization();
  const [prep, setPrep] = useState<ResultadoImport | null>(null);
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ creadas: number; errores: string[] } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file || !organizationId) return;
    setCargando(true); setResultado(null);
    try {
      const [filas, puertos, agentes, navieras, tipos, rutas] = await Promise.all([
        leerArchivo(file), fetchPuertos(), fetchCosteoAgentes(organizationId), fetchNavieras(), fetchTiposContenedor(), fetchCosteoRutas(organizationId),
      ]);
      setPrep(prepararImportacion(filas, { puertos, agentes, navieras, tipos, rutas }));
    } catch (e) {
      setPrep({ tarifas: [], errores: [`No se pudo leer el archivo: ${msg(e)}`] });
    } finally { setCargando(false); }
  };

  const importar = async () => {
    if (!prep || !organizationId) return;
    setCargando(true);
    const rutas = new Map<string, string>();
    const errores: string[] = [];
    let creadas = 0;
    for (const t of prep.tarifas) {
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
    setResultado({ creadas, errores }); setPrep(null); setCargando(false);
    if (creadas > 0) onDone();
  };

  const cerrar = (v: boolean) => { if (!v) { setPrep(null); setResultado(null); } onOpenChange(v); };
  const footer = (
    <>
      <Button variant="outline" onClick={() => cerrar(false)}>Cerrar</Button>
      {prep && prep.tarifas.length > 0 && (
        <Button onClick={() => void importar()} disabled={cargando}>
          {cargando ? "Importando…" : `Importar ${prep.tarifas.length} tarifa(s)`}
        </Button>
      )}
    </>
  );
  const errores = resultado?.errores ?? prep?.errores ?? [];

  return (
    <FormDialogShell open={open} onOpenChange={cerrar} icon={Upload} title="Importar tarifas"
      description="Sube un CSV o Excel con las columnas del archivo «Descargar Excel»." size="lg" footer={footer}>
      <div className="space-y-3 text-body-sm">
        <p className="text-muted-foreground">
          Columnas: Origen, Destino, Agente, Naviera, Tarifa 20&quot; (USD), Tarifa 40&quot; (USD), Inicio de la vigencia,
          Término de la vigencia, Días libres de demoras, Observaciones. Origen y destino pueden ser nombre o código del puerto;
          agente y naviera deben existir en el catálogo. Fechas en DD/MM/AAAA. Las tarifas entran en borrador hasta aprobarse, igual que al capturarlas a mano.
        </p>
        <input type="file" accept=".csv,.xlsx,.xls" aria-label="Archivo de tarifas" disabled={cargando}
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {cargando && !prep && <p>Leyendo archivo…</p>}
        {prep && <p>Listas para importar: <strong>{prep.tarifas.length}</strong> tarifa(s). Renglones con error: <strong>{prep.errores.length}</strong> (se omiten).</p>}
        {resultado && <p>Se importaron <strong>{resultado.creadas}</strong> tarifa(s).</p>}
        {errores.length > 0 && (
          <ul className="max-h-48 list-disc space-y-1 overflow-auto rounded-md border p-3 pl-6 text-destructive">
            {errores.slice(0, 100).map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
    </FormDialogShell>
  );
}
