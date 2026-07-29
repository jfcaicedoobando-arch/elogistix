/**
 * FacturaBitacoraCard — historial de eventos de la factura leído por RPC
 * segura, incluyendo bitácora `facturas` y `facturacion`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { useFacturaHistorial } from "@/features/facturacion/hooks/useFacturaHistorial";
import { formatDate } from "@/lib/formatters";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";
import { History } from "lucide-react";

interface Props {
  facturaId: string;
}

const ACCION_LABELS: Record<string, string> = {
  facturapi_emitida: "Timbrada",
  facturapi_cancelada: "Cancelada",
  facturapi_cancelacion_solicitada: "Cancelación solicitada",
  facturapi_sustituida: "Sustituida",
  facturapi_consulta_reconciliada: "Estado reconciliado con FacturApi",
  facturapi_emitir_failed: "Error al timbrar",
  facturapi_cancelar_failed: "Error al cancelar",
  "factura.borrador_generado": "Borrador generado",
  "factura.borrador_eliminado": "Borrador eliminado",
  factura_duplicada_para_sustitucion: "Duplicada para sustitución",
  enviada_cliente: "Enviada al cliente",
  crear: "Creada",
  actualizar: "Actualizada",
  eliminar: "Eliminada",
};

function etiquetaAccion(accion: string): string {
  if (ACCION_LABELS[accion]) return ACCION_LABELS[accion];
  const limpio = accion.replace(/[._]/g, " ").trim();
  return limpio.charAt(0).toUpperCase() + limpio.slice(1);
}

export function FacturaBitacoraCard({ facturaId }: Props) {
  const { data, isLoading, isError } = useFacturaHistorial(facturaId);

  const entradas = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Historial de la factura
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : isError ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No se pudo cargar el historial de esta factura.
          </p>
        ) : entradas.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Sin eventos registrados para esta factura.
          </p>
        ) : (
          <ul className="divide-y">
            {entradas.map((e) => {
              const descripcion = describirEntrada(e);
              const detalle = [e.entidad_nombre, e.usuario_email].filter(Boolean).join(" • ");
              return (
                <li key={e.id} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{descripcion.titulo || etiquetaAccion(e.accion)}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </span>
                  </div>
                  {descripcion.contexto && (
                    <p className="text-xs text-muted-foreground truncate">
                      {descripcion.contexto}
                    </p>
                  )}
                  {detalle && (
                    <p className="text-xs text-muted-foreground truncate">{detalle}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
