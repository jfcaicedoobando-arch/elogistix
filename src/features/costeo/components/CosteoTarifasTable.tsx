/**
 * Tabla de tarifas marítimas (cuerpo de CosteoTarifas).
 * Extraído para cumplir Power of 10 (≤200 líneas).
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Copy, Pencil, Trash2 } from "lucide-react";
import { TarifaEstadoBadge } from "./TarifaEstadoBadge";
import { usd } from "../routes/CosteoTarifas.helpers";

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
  estado: string;
}

interface Props {
  tarifas: TarifaRow[];
  isLoading: boolean;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

export function CosteoTarifasTable({ tarifas, isLoading, onEditar, onDuplicar, onEliminar }: Props) {
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
                <div className="flex gap-1 justify-end">
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
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
