/**
 * Paso 3 — Crear (y timbrar) la nueva factura al cliente destino.
 * El borrador se genera con la RPC `duplicar_factura_para_refacturacion`.
 */
import { ArrowUpRight, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { facturaNuevaLista } from "@/features/facturacion/domain/refacturacionPasos";
import type { FacturaRefacturacionEstado } from "@/features/facturacion/services/refacturacion";

interface Props {
  facturaNueva: FacturaRefacturacionEstado | null;
  clienteDestinoNombre: string;
  duplicando: boolean;
  consultando: boolean;
  onDuplicar: () => void;
  onIrABorrador: (facturaId: string) => void;
  onRefrescar: () => void;
}

export function PasoFacturaNueva(props: Props) {
  const nueva = props.facturaNueva;
  const lista = facturaNuevaLista(nueva);

  return (
    <FormDialogSection
      title="Nueva factura para el receptor correcto"
      description="Se copian conceptos y vínculos del embarque; los datos fiscales se toman del cliente destino."
      flat
    >
      {!nueva && (
        <div className="space-y-3">
          <p className="text-sm">
            Se creará un borrador a nombre de <strong>{props.clienteDestinoNombre}</strong> con
            los mismos conceptos e importes de la factura original.
          </p>
          <Button onClick={props.onDuplicar} loading={props.duplicando}>
            <Copy className="h-4 w-4 mr-1" /> Crear borrador
          </Button>
        </div>
      )}

      {nueva && (
        <div className="space-y-3">
          <div className="rounded-md border p-3 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{nueva.numero}</p>
              <Badge variant={lista ? "secondary" : "outline"}>
                {lista ? "Timbrada" : nueva.estado}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {nueva.cliente_nombre ?? "—"}
              {nueva.rfc_cliente ? ` · ${nueva.rfc_cliente}` : ""}
            </p>
            {nueva.uuid_fiscal && (
              <p className="text-xs text-muted-foreground break-all">UUID {nueva.uuid_fiscal}</p>
            )}
          </div>

          {lista ? (
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
              <span>La nueva factura está timbrada. Puedes continuar.</span>
            </div>
          ) : (
            <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
              Abre el borrador, revisa los datos fiscales y tímbralo. Al volver, este
              asistente retoma en este mismo paso.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => props.onIrABorrador(nueva.id)}>
              <ArrowUpRight className="h-4 w-4 mr-1" />
              {lista ? "Ver la nueva factura" : "Abrir y timbrar"}
            </Button>
            <Button variant="outline" onClick={props.onRefrescar} loading={props.consultando}>
              Actualizar estado
            </Button>
          </div>
        </div>
      )}
    </FormDialogSection>
  );
}
