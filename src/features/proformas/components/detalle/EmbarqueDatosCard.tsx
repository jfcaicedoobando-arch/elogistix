/**
 * Card "Datos del embarque" — modo, tipo, incoterm, ruta, contenedores y
 * descripción de mercancía. Se oculta si la proforma no tiene embarque.
 */
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  resumirContenedores,
  resolverUbicacion,
} from "@/features/proformas/domain/proformaDetalleHelpers";
import type { ProformaEmbarqueFull } from "@/features/proformas/services";

interface Props {
  embarque: ProformaEmbarqueFull | null;
  embarqueId?: string | null;
  expediente?: string | null;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate" title={value ?? ""}>{value?.trim() || "—"}</p>
    </div>
  );
}

export function EmbarqueDatosCard({ embarque, embarqueId, expediente }: Props) {
  if (!embarque) return null;
  const origen = resolverUbicacion(embarque.puerto_origen, embarque.aeropuerto_origen, embarque.ciudad_origen);
  const destino = resolverUbicacion(embarque.puerto_destino, embarque.aeropuerto_destino, embarque.ciudad_destino);
  const contenedores = embarque.contenedores ?? [];
  const resumenContenedores = contenedores.length > 0 ? resumirContenedores(contenedores) : null;
  const mercancia = embarque.descripcion_mercancia?.trim() || null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="truncate">
          Embarque{expediente ? ` ${expediente}` : ""}
        </CardTitle>
        {embarqueId && (
          <Link
            to={`/embarques/${embarqueId}?tab=facturacion`}
            className="text-xs text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            Ver embarque <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="text-sm space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Field label="Modo" value={embarque.modo} />
          <Field label="Tipo" value={embarque.tipo} />
          <Field label="Incoterm" value={embarque.incoterm} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Ruta</p>
          <p className="break-words">
            <span className="font-medium">{origen}</span>
            <span className="mx-2 text-muted-foreground">→</span>
            <span className="font-medium">{destino}</span>
          </p>
        </div>
        {embarque.bl_house && (
          <div>
            <p className="text-xs text-muted-foreground">BL House / HAWB</p>
            <p className="font-mono break-all">{embarque.bl_house}</p>
          </div>
        )}
        {resumenContenedores && (
          <div>
            <p className="text-xs text-muted-foreground">Contenedores</p>
            <p className="break-words">{resumenContenedores}</p>
          </div>
        )}
        {mercancia && (
          <div>
            <p className="text-xs text-muted-foreground">Descripción de la mercancía</p>
            <p className="whitespace-pre-line break-words">{mercancia}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
