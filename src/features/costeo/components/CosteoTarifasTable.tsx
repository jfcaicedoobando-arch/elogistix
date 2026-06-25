/**
 * Tabla de tarifas marítimas (cuerpo de CosteoTarifas).
 * v13.135.49: badge unificado + dropdown de acciones.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TarifaEstadoUnificado } from "./TarifaEstadoUnificado";
import { TarifaRowActions } from "./TarifaRowActions";
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

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ruta</TableHead>
            <TableHead>Agente / Naviera</TableHead>
            <TableHead>Contenedor</TableHead>
            <TableHead className="text-right">Flete</TableHead>
            <TableHead className="text-right">Recargos</TableHead>
            <TableHead className="text-right">Total USD</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-12 text-right">Acciones</TableHead>
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
            return (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{t.puerto_origen_nombre} → {t.puerto_destino_nombre}</TableCell>
                <TableCell>
                  <div className="font-medium">{t.agente_nombre}</div>
                  <div className="text-xs text-muted-foreground">{t.naviera_nombre}</div>
                </TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(Number(t.flete_base))}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(t.recargos_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(t.total_comparable)}</TableCell>
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
