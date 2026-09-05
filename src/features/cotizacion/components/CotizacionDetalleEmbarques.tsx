import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/formatters";

interface EmbarqueVinculado {
  id: string;
  expediente: string | null;
  estado: string;
  created_at: string;
}

interface Props {
  embarques: EmbarqueVinculado[];
  cotizacionEstado: string;
}

export function CotizacionDetalleEmbarques({ embarques, cotizacionEstado }: Props) {
  // Mostrar la tarjeta cuando hay embarques vinculados, o cuando la cotización
  // ya está "En operación" / "Cerrada" para indicar que debería haberlos.
  const estadoSugiereEmbarque = cotizacionEstado === "En operación" || cotizacionEstado === "Cerrada";
  if (embarques.length === 0 && !estadoSugiereEmbarque) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Embarques Generados</CardTitle></CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <p className="text-body text-muted-foreground">
            Esta cotización aparece como <strong>{cotizacionEstado}</strong>, pero no hay embarques vinculados.
            Verifica con tu administrador o vuelve a generar el embarque desde el botón <em>Crear embarque</em>.
          </p>
        ) : (
          <div className="space-y-2">
            {embarques.map((emb) => (
              // Link semántico: navegable con teclado (Enter) y con foco visible.
              <Link
                key={emb.id}
                to={`/embarques/${emb.id}`}
                aria-label={`Abrir embarque ${emb.expediente ?? "sin expediente"} (${emb.estado})`}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span className="font-medium text-primary">{emb.expediente}</span>
                <div className="flex items-center gap-3">
                  <StatusBadge domain="embarque" status={emb.estado} />
                  <span className="text-body text-muted-foreground">{formatDate(emb.created_at)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
