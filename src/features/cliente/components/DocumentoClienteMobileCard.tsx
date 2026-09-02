/**
 * Tarjeta móvil del expediente documental del cliente.
 * Extraída al migrar `ClienteDocumentosTab` de `DataTable` a `ResponsiveDataTable`.
 */
import { Download, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import {
  estadoVigencia,
  formatTamano,
  type EstadoVigencia,
} from "@/features/expediente/domain/expediente";
import type { DocumentoCliente } from "@/features/cliente/domain/documentosCliente";

const TONO_VIGENCIA: Record<EstadoVigencia, string> = {
  Vigente: "bg-success/15 text-success border-success/30",
  "Por vencer": "bg-warning/15 text-warning border-warning/30",
  Vencido: "bg-destructive/15 text-destructive border-destructive/30",
  "Sin vigencia": "bg-muted text-muted-foreground border-border",
};

interface Props {
  doc: DocumentoCliente;
  onDescargar: (doc: DocumentoCliente) => void;
  onEliminar?: (doc: DocumentoCliente) => void;
}

export function DocumentoClienteMobileCard({ doc, onDescargar, onEliminar }: Props) {
  const estado = estadoVigencia(doc.fecha_vencimiento);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-body truncate">{doc.tipo}</div>
        <div className="text-label text-muted-foreground truncate mt-0.5">{doc.nombre}</div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className={TONO_VIGENCIA[estado]}>{estado}</Badge>
          <span className="text-label text-muted-foreground">{formatTamano(doc.tamano_bytes)}</span>
        </div>
        <div className="text-label text-muted-foreground mt-0.5">
          {doc.fecha_documento ? formatDate(doc.fecha_documento) : "—"}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Descargar ${doc.nombre}`}
          onClick={(e) => { e.stopPropagation(); onDescargar(doc); }}
        >
          <Download className="h-4 w-4" />
        </Button>
        {onEliminar && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Eliminar ${doc.nombre}`}
            className="text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onEliminar(doc); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
