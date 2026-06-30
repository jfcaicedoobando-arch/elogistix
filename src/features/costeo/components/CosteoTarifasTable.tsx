/**
 * Tabla de tarifas marítimas (cuerpo de CosteoTarifas).
 * v13.142.4: Aprobar/Rechazar inline (icon-only) para borradores + columnas Flete/Recargos ocultas <lg.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TarifaEstadoUnificado } from "./TarifaEstadoUnificado";
import { TarifaRowActions } from "./TarifaRowActions";
import { TarifaQuickApprovalButtons } from "./TarifaQuickApprovalButtons";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { usd, formatVigencia, vigenciaHint } from "../routes/CosteoTarifas.helpers";
import type { CosteoTarifaEstado } from "@/features/costeo/types";

interface TarifaRow {
  id: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  flete_base: number | string;
  recargos_total: number;
  total_comparable: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: CosteoTarifaEstado;
  estado_aprobacion?: string;
  motivo_rechazo?: string | null;
}

interface Props {
  tarifas: TarifaRow[];
  isLoading: boolean;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

export function CosteoTarifasTable({ tarifas, isLoading, onEditar, onDuplicar, onEliminar }: Props) {
  const { aprobar, rechazar, reactivar } = useAprobacionTarifa();
  const [rechazandoId, setRechazandoId] = useState<string | null>(null);

  // Mejor total por (ruta + contenedor) entre elegibles (vigente y no rechazada/reemplazada).
  const mejorPorGrupo = useMemo(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    const map = new Map<string, number>();
    for (const t of tarifas) {
      const ap = t.estado_aprobacion ?? "vigente";
      if (ap !== "vigente" || t.vigente_hasta < hoy || t.estado === "reemplazada") continue;
      const k = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
      const prev = map.get(k);
      if (prev == null || t.total_comparable < prev) map.set(k, t.total_comparable);
    }
    return map;
  }, [tarifas]);

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ruta</TableHead>
            <TableHead>Agente / Naviera</TableHead>
            <TableHead>Contenedor</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Flete</TableHead>
            <TableHead className="text-right hidden lg:table-cell">Recargos</TableHead>
            <TableHead className="text-right">Total USD</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right w-[160px]">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
          )}
          {tarifas.map((t) => {
            const ap = t.estado_aprobacion ?? "vigente";
            const hint = vigenciaHint(t.vigente_hasta);
            const hintCls = hint.tone === "danger" ? "text-destructive" : hint.tone === "warn" ? "text-warning" : "text-muted-foreground";
            const grupoKey = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
            const mejor = mejorPorGrupo.get(grupoKey);
            const esMejor = mejor != null && t.total_comparable === mejor && ap === "vigente";
            const delta = mejor != null && !esMejor && t.total_comparable > mejor ? t.total_comparable - mejor : 0;
            return (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{t.puerto_origen_nombre} → {t.puerto_destino_nombre}</TableCell>
                <TableCell>
                  <div className="font-medium">{t.agente_nombre}</div>
                  <div className="text-xs text-muted-foreground">{t.naviera_nombre}</div>
                </TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums hidden lg:table-cell">{usd(Number(t.flete_base))}</TableCell>
                <TableCell className="text-right tabular-nums hidden lg:table-cell">{usd(t.recargos_total)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <div className={`font-semibold ${esMejor ? "text-success" : ""}`}>{usd(t.total_comparable)}</div>
                  {delta > 0 && (
                    <div className="text-[11px] text-muted-foreground">+{usd(delta)} vs mejor</div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div className="text-foreground">{formatVigencia(t.vigente_desde, t.vigente_hasta)}</div>
                  <div className={hintCls}>{hint.text}</div>
                </TableCell>
                <TableCell>
                  <TarifaEstadoUnificado
                    estado={t.estado}
                    estadoAprobacion={ap}
                    vigenteHasta={t.vigente_hasta}
                    motivo={t.motivo_rechazo}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {ap === "borrador" && (
                      <TarifaQuickApprovalButtons
                        variant="table"
                        onAprobar={() => aprobar.mutate(t.id)}
                        onRechazar={() => setRechazandoId(t.id)}
                        disabled={aprobar.isPending || reactivar.isPending}
                      />
                    )}
                    <TarifaRowActions
                      estadoAprobacion={ap}
                      onEditar={() => onEditar(t.id)}
                      onDuplicar={() => onDuplicar(t.id)}
                      onEliminar={() => onEliminar(t.id)}
                      onAprobar={() => aprobar.mutate(t.id)}
                      onRechazar={() => setRechazandoId(t.id)}
                      onReactivar={() => reactivar.mutate(t.id)}
                      disabled={aprobar.isPending || reactivar.isPending}
                    />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <DialogRechazarTarifa
        open={!!rechazandoId}
        onOpenChange={(o) => !o && setRechazandoId(null)}
        pending={rechazar.isPending}
        onConfirm={(motivo) => {
          if (!rechazandoId) return;
          rechazar.mutate(
            { id: rechazandoId, motivo },
            { onSuccess: () => setRechazandoId(null) },
          );
        }}
      />
    </Card>
  );
}
