/** Vista 1 del tarifario: Tarifas (Puertos base) con 20"/40" en una fila. */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { exportToCsv } from "@/generators/exportCsv";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import { hoyMx } from "@/lib/date/mx";
import { agruparTarifas, listarTarifasTarifario, type FilaTarifario, type TarifaTarifario } from "./tarifarioService";

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

export function TarifasBaseTab({ puedeEditar }: { puedeEditar: boolean }) {
  const [vencidas, setVencidas] = useState(false);
  const [texto, setTexto] = useState("");
  const [nueva, setNueva] = useState(false);
  const q = useQuery({ queryKey: ["tarifario", "tarifas", vencidas], queryFn: () => listarTarifasTarifario(vencidas, hoyMx()) });
  const filas = useMemo(() => {
    const t = texto.trim().toLowerCase();
    const all = agruparTarifas(q.data ?? []);
    return t ? all.filter((f) => [f.origen, f.destino, f.agente, f.naviera].join(" ").toLowerCase().includes(t)) : all;
  }, [q.data, texto]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Buscar origen, destino, agente o naviera" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <label className="flex items-center gap-2 text-body-sm"><Switch checked={vencidas} onCheckedChange={setVencidas} /> Ver vencidas</label>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => exportToCsv(`tarifario-${hoyMx()}.csv`, HEADERS, filas.map(aCsv))}>
            <Download className="mr-1 size-4" /> Descargar Excel
          </Button>
          {puedeEditar && <Button onClick={() => setNueva(true)}><Plus className="mr-1 size-4" /> Nueva tarifa</Button>}
        </div>
      </div>
      {q.isError && <p className="text-body-sm text-destructive">No se pudo cargar el tarifario.</p>}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader><TableRow>{HEADERS.map((h) => <TableHead key={h.key}>{h.label}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.clave}>
                <TableCell>{f.origen}</TableCell><TableCell>{f.destino}</TableCell><TableCell>FCL</TableCell>
                <TableCell>{f.agente}</TableCell><TableCell>{f.naviera}</TableCell>
                <TableCell className="tabular-nums">{usd(f.tarifa20)}</TableCell>
                <TableCell className="tabular-nums">{usd(f.tarifa40)}</TableCell>
                <TableCell>{fecha(f.base.vigente_desde)}</TableCell><TableCell>{fecha(f.base.vigente_hasta)}</TableCell>
                <TableCell>{f.base.dias_libres_demoras ?? "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{f.base.notas ?? ""}</TableCell>
              </TableRow>
            ))}
            {!q.isLoading && filas.length === 0 && (
              <TableRow><TableCell colSpan={HEADERS.length} className="text-center text-muted-foreground">Sin tarifas vigentes.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <p className="text-caption text-muted-foreground">Para editar o duplicar una tarifa usa el catálogo de tarifas; la versión anterior se conserva como histórico.</p>
      {nueva && <TarifaForm open={nueva} onOpenChange={setNueva} onSaved={() => { void q.refetch(); }} />}
    </div>
  );
}
