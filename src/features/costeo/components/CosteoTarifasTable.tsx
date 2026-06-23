/**
 * Tabla de tarifas marítimas (cuerpo de CosteoTarifas).
 * v13.130.0: agrega columna y acciones de aprobación.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Check, Copy, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { TarifaEstadoBadge } from "./TarifaEstadoBadge";
import { EstadoAprobacionBadge } from "./EstadoAprobacionBadge";
import { DialogRechazarTarifa } from "./DialogRechazarTarifa";
import { useAprobacionTarifa } from "../hooks/useAprobacionTarifa";
import { usd } from "../routes/CosteoTarifas.helpers";
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
            <TableHead>Agente</TableHead>
            <TableHead>Naviera</TableHead>
            <TableHead>Contenedor</TableHead>
            <TableHead className="text-right">Flete</TableHead>
            <TableHead className="text-right">Recargos</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Vigencia</TableHead>
            <TableHead>Vigencia téc.</TableHead>
            <TableHead>Aprobación</TableHead>
            <TableHead className="w-44 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Cargando…</TableCell></TableRow>
          )}
          {!isLoading && tarifas.length === 0 && (
            <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">Sin tarifas para los filtros aplicados.</TableCell></TableRow>
          )}
          {tarifas.map((t) => {
            const ap = t.estado_aprobacion ?? "vigente";
            return (
              <TableRow key={t.id}>
                <TableCell className="text-sm">{t.puerto_origen_nombre} → {t.puerto_destino_nombre}</TableCell>
                <TableCell className="font-medium">{t.agente_nombre}</TableCell>
                <TableCell>{t.naviera_nombre}</TableCell>
                <TableCell>{t.tipo_contenedor_nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(Number(t.flete_base))}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(t.recargos_total)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(t.total_comparable)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{t.vigente_desde} → {t.vigente_hasta}</TableCell>
                <TableCell>
                  <TarifaEstadoBadge estado={t.estado} vigenteHasta={t.vigente_hasta} />
                </TableCell>
                <TableCell>
                  <EstadoAprobacionBadge estado={ap} motivo={t.motivo_rechazo} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {ap === "borrador" && (
                      <>
                        <Button
                          size="icon" variant="ghost"
                          className="text-success hover:text-success"
                          onClick={() => aprobar.mutate(t.id)}
                          disabled={aprobar.isPending}
                          aria-label="Aprobar tarifa"
                          title="Aprobar"
                        >
                          <Check className="size-4" />
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRechazandoId(t.id)}
                          aria-label="Rechazar tarifa"
                          title="Rechazar"
                        >
                          <X className="size-4" />
                        </Button>
                      </>
                    )}
                    {ap === "rechazada" && (
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => reactivar.mutate(t.id)}
                        disabled={reactivar.isPending}
                        aria-label="Reactivar como borrador"
                        title="Reactivar como borrador"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => onEditar(t.id)} aria-label="Editar tarifa">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDuplicar(t.id)} aria-label="Duplicar tarifa">
                      <Copy className="size-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onEliminar(t.id)} aria-label="Eliminar tarifa">
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
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
