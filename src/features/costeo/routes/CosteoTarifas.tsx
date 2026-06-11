/**
 * Página: matriz de tarifas marítimas (alta + lista filtrable).
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy } from "lucide-react";
import {
  useCosteoTarifas, useCosteoTarifaMutations,
} from "@/features/costeo/hooks/useCosteoTarifas";
import { useCosteoAgentes } from "@/features/costeo/hooks/useCosteoAgentes";
import { useTiposContenedor } from "@/hooks/catalogos";
import { TarifaForm } from "@/features/costeo/components/TarifaForm";
import { TarifaEstadoBadge } from "@/features/costeo/components/TarifaEstadoBadge";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

const usd = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(n);

type EstadoFiltro = "vigente" | "vencida" | "reemplazada" | "todas";

export default function CosteoTarifas() {
  const [estado, setEstado] = useState<EstadoFiltro>("vigente");
  const [agenteId, setAgenteId] = useState<string>("todos");
  const [tipoId, setTipoId] = useState<string>("todos");
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<TarifaInput> | undefined>();

  const { data: agentes = [] } = useCosteoAgentes();
  const { data: tipos = [] } = useTiposContenedor();
  const { data: tarifas = [], isLoading } = useCosteoTarifas({
    estado,
    agenteId: agenteId === "todos" ? undefined : agenteId,
    tipoContenedorId: tipoId === "todos" ? undefined : tipoId,
  });
  const { eliminar } = useCosteoTarifaMutations();

  const duplicar = (id: string) => {
    const t = tarifas.find((x) => x.id === id);
    if (!t) return;
    setInitial({
      agente_id: t.agente_id,
      naviera_id: t.naviera_id,
      ruta_id: t.ruta_id,
      tipo_contenedor_id: t.tipo_contenedor_id,
      flete_base: Number(t.flete_base),
      dias_libres_demoras: t.dias_libres_demoras,
      vigente_desde: new Date().toISOString().slice(0, 10),
      vigente_hasta: t.vigente_hasta,
      transit_time_dias: t.transit_time_dias,
      notas: t.notas,
      recargos: (t.recargos ?? []).map((r) => ({
        concepto: r.concepto,
        lado: r.lado ?? undefined,
        monto: Number(r.monto),
        moneda: r.moneda ?? "USD",
        incluido_en_total: r.incluido_en_total ?? true,
      })),
    });
    setOpen(true);
  };

  const nuevo = () => { setInitial(undefined); setOpen(true); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tarifas marítimas (USD)</h1>
          <p className="text-sm text-muted-foreground">
            Matriz CN → MX por agente, naviera, ruta y tipo de contenedor. El total comparable suma flete + recargos.
          </p>
        </div>
        <Button onClick={nuevo}>
          <Plus className="size-4 mr-2" /> Nueva tarifa
        </Button>
      </div>

      <Card className="p-4 flex flex-wrap gap-3">
        <div className="min-w-[140px]">
          <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFiltro)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vigente">Vigentes</SelectItem>
              <SelectItem value="vencida">Vencidas</SelectItem>
              <SelectItem value="reemplazada">Reemplazadas</SelectItem>
              <SelectItem value="todas">Todas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <Select value={agenteId} onValueChange={setAgenteId}>
            <SelectTrigger><SelectValue placeholder="Agente" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los agentes</SelectItem>
              {agentes.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Select value={tipoId} onValueChange={setTipoId}>
            <SelectTrigger><SelectValue placeholder="Contenedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ruta</TableHead>
              <TableHead>Agente</TableHead>
              <TableHead>Naviera</TableHead>
              <TableHead>Contenedor</TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Recargos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vigencia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && tarifas.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sin tarifas para los filtros aplicados.</TableCell></TableRow>
            )}
            {tarifas.map((t) => (
              <TableRow key={t.id} className="hover:bg-muted/30">
                <TableCell className="text-sm">
                  {t.puerto_origen_nombre} → {t.puerto_destino_nombre}
                </TableCell>
                <TableCell className="font-medium">{t.agente_nombre}</TableCell>
                <TableCell>{t.naviera_nombre}</TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(Number(t.flete_base))}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(t.recargos_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(t.total_comparable)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {t.vigente_desde} → {t.vigente_hasta}
                </TableCell>
                <TableCell>
                  <TarifaEstadoBadge estado={t.estado} vigenteHasta={t.vigente_hasta} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" onClick={() => duplicar(t.id)} aria-label="Duplicar">
                      <Copy className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => { if (confirm("¿Eliminar esta tarifa?")) eliminar.mutate(t.id); }}
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <TarifaForm open={open} onOpenChange={setOpen} initial={initial} />
    </div>
  );
}
