import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getEstadoColor } from "@/components/shared/utils/uiMappings";
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

  // Mostrar la tarjeta cuando hay embarques vinculados, o cuando la cotización
  // ya está "En operación" / "Cerrada" para indicar que debería haberlos.
  const estadoSugiereEmbarque = cotizacionEstado === "En operación" || cotizacionEstado === "Cerrada";
  if (embarques.length === 0 && !estadoSugiereEmbarque) return null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">Embarques Generados</CardTitle></CardHeader>
      <CardContent>
        {embarques.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Esta cotización aparece como <strong>{cotizacionEstado}</strong>, pero no hay embarques vinculados.
            Verifica con tu administrador o vuelve a generar el embarque desde el botón <em>Crear embarque</em>.
          </p>
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
  embarqueIdVinculado: string | null;
  onCambiarEstado: (e: "Enviada" | "Aceptada" | "Rechazada") => void;
  onAbrirConvertir: () => void;
}

export function CotizacionDetalleAcciones({
  estado, esProspecto, numContenedores, cotizacionId, embarqueIdVinculado,
  onCambiarEstado, onAbrirConvertir,
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
        <Button size="sm" onClick={onAbrirConvertir}>Convertir a Cliente</Button>
      )}
      {esAceptada && !esProspecto && embarqueIdVinculado && (
        <Button size="sm" onClick={() => navigate(`/embarques/${embarqueIdVinculado}`)}>
          Ver embarque borrador
        </Button>
      )}
      {esAceptada && !esProspecto && !embarqueIdVinculado && (
        <Button
          size="sm"
          onClick={() => navigate("/embarques/nuevo", { state: { cotizacionPrevinculadaId: cotizacionId } })}
        >
          Crear embarque
          {numContenedores > 1 && <Badge variant="secondary" className="ml-2">{numContenedores}</Badge>}
        </Button>
      )}
    </div>
  );
}


