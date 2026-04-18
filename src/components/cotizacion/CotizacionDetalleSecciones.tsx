import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getEstadoColor } from "@/lib/uiMappings";
import { formatDate } from "@/lib/formatters";

interface EmbarqueVinculado {
  id: string;
  expediente: string;
  estado: string;
  created_at: string;
}

interface Props {
  embarques: EmbarqueVinculado[];
  cotizacionEstado: string;
}

export function CotizacionDetalleEmbarques({ embarques, cotizacionEstado }: Props) {
  const navigate = useNavigate();

  if (cotizacionEstado !== "Embarcada" && embarques.length === 0) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Embarques Generados</CardTitle></CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {embarques.map((emb) => (
              <div
                key={emb.id}
                className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 cursor-pointer"
                onClick={() => navigate(`/embarques/${emb.id}`)}
              >
                <span className="font-medium text-primary">{emb.expediente}</span>
                <div className="flex items-center gap-3">
                  <Badge className={getEstadoColor(emb.estado)}>{emb.estado}</Badge>
                  <span className="text-sm text-muted-foreground">{formatDate(emb.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface AccionesProps {
  estado: string;
  esProspecto: boolean;
  numContenedores: number;
  cotizacionId: string;
  onCambiarEstado: (e: "Enviada" | "Aceptada" | "Rechazada") => void;
  onAbrirConvertir: () => void;
  onAbrirGenerarEmbarques: () => void;
}

export function CotizacionDetalleAcciones({
  estado, esProspecto, numContenedores, cotizacionId,
  onCambiarEstado, onAbrirConvertir, onAbrirGenerarEmbarques,
}: AccionesProps) {
  const navigate = useNavigate();
  const esBorradorOEnviada = estado === "Borrador" || estado === "Enviada";
  const esAceptada = estado === "Aceptada";

  return (
    <div className="flex flex-wrap gap-2">
      {estado === "Borrador" && (
        <>
          <Button variant="outline" size="sm" onClick={() => navigate(`/cotizaciones/${cotizacionId}/editar`)}>
            Editar
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Enviada")}>
            Marcar como Enviada
          </Button>
        </>
      )}
      {esBorradorOEnviada && (
        <>
          <Button variant="outline" size="sm" onClick={() => onCambiarEstado("Rechazada")}>Rechazar</Button>
          <Button size="sm" onClick={() => onCambiarEstado("Aceptada")}>Aceptar</Button>
        </>
      )}
      {esAceptada && esProspecto && (
        <Button size="sm" variant="secondary" onClick={onAbrirConvertir}>Convertir a Cliente</Button>
      )}
      {esAceptada && (
        <Button size="sm" onClick={onAbrirGenerarEmbarques}>
          Generar Embarques
          <Badge className="ml-2">{numContenedores}</Badge>
        </Button>
      )}
    </div>
  );
}
