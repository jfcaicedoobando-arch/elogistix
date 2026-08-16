/**
 * Tabla accionable de higiene: oportunidades abiertas con días sin movimiento,
 * SLA de su etapa y semáforo.
 */
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states/EmptyState";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatFechaEs } from "@/lib/formatters/dates";
import {
  ETIQUETA_HIGIENE, VARIANTE_HIGIENE, ordenarPorUrgencia,
} from "@/features/crm/domain/higieneMetas";
import type { HigieneOportunidad } from "@/features/crm/services/higiene";

interface Props {
  filas: HigieneOportunidad[];
}

export default function HigieneTabla({ filas }: Props) {
  const navigate = useNavigate();
  const ordenadas = ordenarPorUrgencia(filas);

  if (ordenadas.length === 0) {
    return (
      <EmptyState
        title="Sin oportunidades abiertas"
        description="Cuando el equipo registre oportunidades verás aquí su higiene y SLA."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oportunidad</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="text-right">Días sin mov.</TableHead>
              <TableHead className="text-right">SLA</TableHead>
              <TableHead>Próxima actividad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordenadas.map((fila) => (
              <TableRow
                key={fila.id}
                className="cursor-pointer"
                onClick={() => navigate(`/crm/oportunidades/${fila.id}`)}
              >
                <TableCell>
                  <span className="font-medium">{fila.nombre}</span>
                  {fila.cliente_nombre && (
                    <span className="block text-xs text-muted-foreground">{fila.cliente_nombre}</span>
                  )}
                  {!fila.registro_completo && (
                    <Badge variant="outline" className="mt-1">Datos incompletos</Badge>
                  )}
                </TableCell>
                <TableCell>{fila.etapa_nombre}</TableCell>
                <TableCell className="text-xs">{fila.vendedor_email ?? "Sin asignar"}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(fila.monto_estimado ?? 0, fila.moneda ?? "MXN")}
                </TableCell>
                <TableCell className="text-right">{fila.dias_sin_movimiento}</TableCell>
                <TableCell className="text-right">{fila.sla_dias}</TableCell>
                <TableCell className="text-xs">
                  {fila.proxima_actividad_at
                    ? formatFechaEs(fila.proxima_actividad_at)
                    : "Sin programar"}
                  {fila.actividad_vencida && (
                    <Badge variant="destructive" className="ml-2">Vencida</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={VARIANTE_HIGIENE[fila.estado_higiene]}>
                    {ETIQUETA_HIGIENE[fila.estado_higiene]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
