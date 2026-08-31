/**
 * v13.819.2 — Aviso accionable cuando el documento que se intenta subir al
 * buzón ya existe. Antes sólo decía "búscala en Compras › Facturas", una
 * sección que roles como coordinador logístico no tienen: ahora dice dónde
 * está y, si el usuario puede entrar, ofrece ir al embarque.
 *
 * No navega solo: el operador decide.
 */
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import type { UbicacionDuplicadoBuzon } from "@/features/cxp/services/buzonDuplicado";

interface Props {
  mensaje: string;
  ubicacion: UbicacionDuplicadoBuzon;
  /** Embarque desde el que se está subiendo (tab Costos). */
  embarqueActualId: string;
}

export function AvisoDuplicadoBuzon({ mensaje, ubicacion, embarqueActualId }: Props) {
  const { effectiveRole } = useAuth();
  const destino =
    ubicacion.embarqueId && ubicacion.embarqueId !== embarqueActualId
      ? `/embarques/${ubicacion.embarqueId}`
      : null;
  const puedeVer = Boolean(destino) && hasRouteAccess(effectiveRole, "/embarques");

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Documento duplicado</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{mensaje}</p>
        {puedeVer && destino ? (
          <Button asChild variant="outline" size="sm">
            <Link to={destino}>Ver embarque</Link>
          </Button>
        ) : ubicacion.caso === "otro_embarque" && ubicacion.embarqueExpediente ? (
          <p className="text-xs">
            Pide a Operaciones que revise el embarque {ubicacion.embarqueExpediente}.
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
