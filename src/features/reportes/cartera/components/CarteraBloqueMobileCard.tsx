/**
 * Tarjeta móvil del reporte de Cartera y Antigüedad (CxC/CxP).
 * Extraída al migrar `CarteraBloque` a `ResponsiveDataTable`.
 */
import { Badge } from "@/components/ui/badge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  BUCKET_AGING_LABELS,
  type FilaCartera,
} from "@/features/reportes/cartera/domain/agingCartera";

const CLASE_BUCKET: Record<FilaCartera["bucket"], string> = {
  vigente: "bg-muted text-muted-foreground border-border",
  d_1_30: "bg-warning/10 text-warning border-warning/20",
  d_31_60: "bg-warning/10 text-warning border-warning/20",
  d_61_90: "bg-destructive/10 text-destructive border-destructive/20",
  mas_90: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  row: FilaCartera;
  etiquetaContraparte: string;
}

export function CarteraBloqueMobileCard({ row: f }: Props) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-body truncate">{f.contraparte}</div>
          <div className="text-body-sm text-muted-foreground">
            Folio {f.folio} {f.expediente ? `· ${f.expediente}` : ""}
          </div>
          <div className="text-label text-muted-foreground">
            {f.fechaVencimiento ? `Vence ${formatDate(f.fechaVencimiento)}` : "Sin vencimiento"}
          </div>
          <Badge variant="outline" className={CLASE_BUCKET[f.bucket]}>
            {BUCKET_AGING_LABELS[f.bucket]}
          </Badge>
        </div>
        <MoneyCell
          label="Saldo"
          value={formatCurrency(f.saldo, f.moneda)}
          highlight
          className="shrink-0 max-w-[48%]"
        />
      </div>
      <div className="flex items-center justify-between text-body-sm">
        <span className="text-muted-foreground">MXN al corte</span>
        <span className="font-medium tabular-nums">{formatCurrency(f.mxnCorte, "MXN")}</span>
      </div>
    </div>
  );
}
