/**
 * Encabezado del buzón de facturas de proveedor del embarque: título, resumen
 * por estado y botón de subida.
 *
 * Se separó de `TabFacturasEntrantes.tsx` (Power of 10: ≤ 200 líneas).
 */
import { Inbox, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  resumen: { porCapturar: number; capturadas: number; rechazadas: number };
  sinXml: number;
  puedeSubir: boolean;
  canEdit: boolean;
  onSubir: () => void;
}

export function EntrantesCardHeader({ resumen, sinXml, puedeSubir, canEdit, onSubir }: Props) {
  return (
    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
      <div className="space-y-1">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          Facturas de proveedor recibidas
        </CardTitle>
        <CardDescription>
          Sube el PDF y el XML de la factura en un mismo documento. No creas la factura:
          contabilidad la captura.
        </CardDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="warning" size="sm">{resumen.porCapturar} por capturar</Badge>
          <Badge variant="success" size="sm">{resumen.capturadas} capturadas</Badge>
          {resumen.rechazadas > 0 && (
            <Badge variant="destructive" size="sm">{resumen.rechazadas} rechazadas</Badge>
          )}
          {sinXml > 0 && <Badge variant="warning" size="sm">{sinXml} sin XML</Badge>}
        </div>
      </div>
      {puedeSubir && (
        <Button size="sm" onClick={onSubir}>
          <Upload className="mr-2 h-4 w-4" /> Subir factura
        </Button>
      )}
      {!puedeSubir && canEdit && (
        <p className="max-w-[14rem] text-right text-xs text-muted-foreground">
          La entrega de archivos la hace operaciones; tú capturas la factura en Cuentas por pagar.
        </p>
      )}
    </CardHeader>
  );
}
