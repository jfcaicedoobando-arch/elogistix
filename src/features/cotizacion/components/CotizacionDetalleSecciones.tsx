import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
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

  if (cotizacionEstado !== "En operación" && embarques.length === 0) return null;

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
  embarqueIdVinculado: string | null;
  isCreandoBorrador: boolean;
  onCambiarEstado: (e: "Enviada" | "Aceptada" | "Rechazada") => void;
  onAbrirConvertir: () => void;
  onAbrirGenerarEmbarques: () => void;
  onCrearBorrador: () => void;
}

export function CotizacionDetalleAcciones({
  estado, esProspecto, numContenedores, cotizacionId, embarqueIdVinculado, isCreandoBorrador,
  onCambiarEstado, onAbrirConvertir, onAbrirGenerarEmbarques, onCrearBorrador,
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
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={onAbrirGenerarEmbarques}>
            {numContenedores > 1 ? `Generar ${numContenedores} embarques` : "Crear embarque"}
            {numContenedores > 1 && <Badge variant="secondary" className="ml-2">{numContenedores}</Badge>}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" aria-label="Más opciones de embarque">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Opciones avanzadas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/embarques/nuevo", { state: { cotizacionPrevinculadaId: cotizacionId } })}
              >
                Abrir wizard manual
                <span className="ml-2 text-xs text-muted-foreground">(ajustar antes de guardar)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onCrearBorrador} disabled={isCreandoBorrador}>
                {isCreandoBorrador ? "Creando…" : "Crear borrador rápido"}
                <span className="ml-2 text-xs text-muted-foreground">(sin conceptos)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

