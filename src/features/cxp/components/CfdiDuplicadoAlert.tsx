/**
 * Aviso dentro del modal de captura cuando el CFDI cargado ya está registrado.
 * v13.343.0 — evita que el usuario llene todo el formulario para enterarse
 * hasta el guardado (índice único `ux_proveedor_facturas_uuid_fiscal_org`).
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { describirFacturaExistente, type FacturaExistentePorUuid } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.dup";

interface Props {
  factura: FacturaExistentePorUuid | null;
  onVerFactura: (id: string) => void;
}

export function CfdiDuplicadoAlert({ factura, onVerFactura }: Props) {
  if (!factura) return null;
  // v13.501.0 — La factura previa puede estar cancelada: el usuario no entendía
  // por qué "ya está capturado" pero no aparecía en el listado de CxP.
  const cancelada = factura.estado === "Cancelada";
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {cancelada
          ? "Este CFDI se capturó antes en una factura que fue cancelada"
          : "Este CFDI ya está capturado"}
      </AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>
          Ya existe como {describirFacturaExistente(factura)}.{" "}
          {cancelada
            ? "Aunque esté cancelada, el UUID fiscal sigue ocupado: no puedes volver a capturarlo. Retira el documento del buzón o pide al proveedor un CFDI de reemplazo."
            : "No puedes registrarlo dos veces."}
        </span>
        <Button size="sm" variant="outline" onClick={() => onVerFactura(factura.id)}>
          Ver factura
        </Button>
      </AlertDescription>
    </Alert>
  );
}
