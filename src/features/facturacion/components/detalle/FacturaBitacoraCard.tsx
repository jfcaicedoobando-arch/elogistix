/**
 * FacturaBitacoraCard — historial de eventos de la factura leído por RPC
 * segura, incluyendo bitácora `facturas` y `facturacion`.
 */
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { DocumentoRailCard } from "@/components/shared/documento/DocumentoRailCard";
import { useFacturaHistorial } from "@/features/facturacion/hooks/useFacturaHistorial";
import { formatDate } from "@/lib/formatters";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";


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
    <DocumentoRailCard count={entradas.length}>
      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No se pudo cargar el historial de esta factura.
        </p>
      ) : entradas.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
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
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDate(e.created_at)}
                  </span>
                </div>
                {descripcion.contexto && (
                  <p className="truncate text-xs text-muted-foreground">
                    {descripcion.contexto}
                  </p>
                )}
                {detalle && (
                  <p className="truncate text-xs text-muted-foreground">{detalle}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </DocumentoRailCard>
  );
}

