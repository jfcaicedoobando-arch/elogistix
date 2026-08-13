/**
 * Ola 4 — Semáforo compartido del expediente: qué documentos obligatorios
 * faltan o están por caducar. Se usa igual en cliente y en proveedor.
 */
import { CheckCircle2, AlertTriangle, XCircle, FileUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/formatters";
import type {
  ResumenExpediente,
  RenglonExpediente,
} from "@/features/expediente/domain/expediente";

interface Props {
  titulo: string;
  resumen: ResumenExpediente;
  onAgregar?: (tipo: string) => void;
}

function IconoEstado({ estado }: { estado: RenglonExpediente["estado"] }) {
  if (estado === "Vigente") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (estado === "Sin vigencia") return <CheckCircle2 className="h-4 w-4 text-muted-foreground" />;
  if (estado === "Por vencer") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}

export function ExpedienteResumenCard({ titulo, resumen, onAgregar }: Props) {
  const completo = resumen.cubiertos === resumen.requeridos;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2">
          {titulo}
          <Badge
            variant="outline"
            className={completo
              ? "bg-success/15 text-success border-success/30"
              : "bg-warning/15 text-warning border-warning/30"}
          >
            {resumen.cubiertos} de {resumen.requeridos} · {resumen.completitud}%
          </Badge>
        </CardTitle>
        {resumen.vencidos > 0 && (
          <span className="text-xs text-destructive">
            {resumen.vencidos} documento(s) vencido(s)
          </span>
        )}
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {resumen.renglones.map((r) => (
          <div
            key={r.tipo}
            className="flex items-start justify-between gap-2 rounded-md border p-3"
          >
            <div className="min-w-0 space-y-0.5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <IconoEstado estado={r.estado} />
                <span className="truncate">{r.tipo}</span>
              </p>
              <p className="text-2xs text-muted-foreground">
                {r.documento
                  ? r.documento.fecha_vencimiento
                    ? `${r.estado} · vigente hasta ${formatDate(r.documento.fecha_vencimiento)}`
                    : "En expediente · sin vigencia capturada"
                  : "Falta capturar este documento"}
              </p>
            </div>
            {!r.documento && onAgregar && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Agregar ${r.tipo}`}
                onClick={() => onAgregar(r.tipo)}
              >
                <FileUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
