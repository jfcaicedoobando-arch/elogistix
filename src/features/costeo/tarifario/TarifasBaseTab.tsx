/** Vista 1 del tarifario: Tarifas (Puertos base) con 20"/40" en una fila. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { costeo } from "../queryKeys";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import { hoyMx } from "@/lib/date/mx";
import { agruparTarifas, FILTROS_VIGENCIA, listarTarifasTarifario, type FilaTarifario, type FiltroVigencia, type TarifaTarifario } from "./tarifarioService";

const usd = (t: TarifaTarifario | null) => (t ? formatCurrency(t.flete_base, t.moneda || "USD") : "—");
const fecha = (d: string | null) => (d ? formatDate(d) : "—");

const HEADERS = [
  { key: "origen", label: "Origen" }, { key: "destino", label: "Destino" }, { key: "tipo", label: "Tipo de carga" },
  { key: "agente", label: "Agente" }, { key: "naviera", label: "Naviera" },
  { key: "t20", label: 'Tarifa 20" (USD)' }, { key: "t40", label: 'Tarifa 40" (USD)' },
  { key: "desde", label: "Inicio de la vigencia" }, { key: "hasta", label: "Término de la vigencia" },
  { key: "dias", label: "Días libres de demoras" }, { key: "obs", label: "Observaciones" },
] as const;

function aCsv(f: FilaTarifario) {
  return {
    origen: f.origen, destino: f.destino, tipo: "FCL", agente: f.agente, naviera: f.naviera,
    t20: f.tarifa20?.flete_base ?? "", t40: f.tarifa40?.flete_base ?? "",
    desde: f.base.vigente_desde ?? "", hasta: f.base.vigente_hasta ?? "",
    dias: f.base.dias_libres_demoras ?? "", obs: f.base.notas ?? "",
  };
}

const columns = defineColumns<FilaTarifario>([
  { accessorKey: "origen", header: "Origen" },
  { accessorKey: "destino", header: "Destino" },
  { id: "tipo", header: "Tipo de carga", accessorFn: () => "FCL" },
  { accessorKey: "agente", header: "Agente" },
  { accessorKey: "naviera", header: "Naviera" },
  { id: "t20", header: 'Tarifa 20" (USD)', accessorFn: (f) => usd(f.tarifa20) },
  { id: "t40", header: 'Tarifa 40" (USD)', accessorFn: (f) => usd(f.tarifa40) },
  { id: "desde", header: "Inicio de la vigencia", accessorFn: (f) => fecha(f.base.vigente_desde) },
  { id: "hasta", header: "Término de la vigencia", accessorFn: (f) => fecha(f.base.vigente_hasta) },
  { id: "dias", header: "Días libres de demoras", accessorFn: (f) => f.base.dias_libres_demoras ?? "—" },
  { id: "obs", header: "Observaciones", accessorFn: (f) => f.base.notas ?? "" },
]);

export function TarifasBaseTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [filtro, setFiltro] = useState<FiltroVigencia>("vigentes");
  const [texto, setTexto] = useState("");
  const [nueva, setNueva] = useState(false);
  const q = useQuery({ queryKey: costeo.tarifario.tarifas(filtro), queryFn: () => listarTarifasTarifario(filtro, hoyMx()) });
  const etiquetaFiltro = FILTROS_VIGENCIA.find((f) => f.valor === filtro)?.etiqueta ?? "";
  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const all = agruparTarifas(q.data ?? []);
    return t ? all.filter((f) => [f.origen, f.destino, f.agente, f.naviera].join(" ").toLowerCase().includes(t)) : all;
  }, [q.data, texto]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Buscar origen, destino, agente o naviera" className="max-w-xs" placeholder="Buscar origen, destino, agente o naviera" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroVigencia)}>
          <SelectTrigger className="w-auto gap-1.5" aria-label="Filtrar por vigencia">
            <span className="text-body-sm text-muted-foreground">Vigencia:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTROS_VIGENCIA.map((f) => <SelectItem key={f.valor} value={f.valor}>{f.etiqueta}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv(`tarifario-${hoyMx()}.csv`, HEADERS, filas.map(aCsv))}>
            <Download className="mr-1 size-4" /> Descargar Excel
          </Button>
          {puedeEditar && <Button onClick={() => setNueva(true)}><Plus className="mr-1 size-4" /> Nueva tarifa</Button>}
        </div>
      </div>
      <DataTable columns={columns} data={filas} rowKey={(f) => f.clave} isLoading={q.isLoading}
        isError={q.isError} onRetry={() => { void q.refetch(); }}
        emptyMessage={filtro === "todas" ? "Sin tarifas capturadas." : `Sin tarifas ${etiquetaFiltro.toLowerCase()}.`} />
      <p className="text-caption text-muted-foreground">Para editar o duplicar una tarifa usa el catálogo de tarifas; la versión anterior se conserva como histórico.</p>
      {nueva && <TarifaForm open={nueva} onOpenChange={setNueva} onSaved={() => { void q.refetch(); }} />}
    </div>
  );
}
