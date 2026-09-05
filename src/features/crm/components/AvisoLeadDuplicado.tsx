/**
 * Aviso de lead duplicado en alta manual (v13.630.0 — Ola A CRM).
 * No bloquea: informa contra qué lead existente coincide para evitar
 * cartera sucia (mismo prospecto capturado por dos vendedores).
 */
import { Copy, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDuplicadoLead } from "@/features/crm/hooks/useLeadsDuplicados";

interface Props {
  empresa: string;
  email: string;
  telefono: string;
}

export function AvisoLeadDuplicado({ empresa, email, telefono }: Props) {
  const { coincidencia, isError, refetch } = useDuplicadoLead({ empresa, email, telefono });

  // Falla cerrada: si la revisión RPC falló (RLS/red/timeout) NO se asume
  // "sin coincidencias"; se avisa sin bloquear y se ofrece reintentar.
  if (isError) {
    return (
      <Alert variant="default">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>No pudimos comprobar duplicados</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-2 text-body-sm">
          <span>Revisa la cartera antes de crear; la verificación automática falló.</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Reintentar
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!coincidencia || coincidencia.nivel === "nuevo") return null;

  const ex = coincidencia.existente;
  return (
    <Alert variant={coincidencia.nivel === "exacto" ? "destructive" : "default"}>
      <Copy className="h-4 w-4" />
      <AlertTitle>
        {coincidencia.nivel === "exacto"
          ? "Este prospecto ya existe"
          : "Posible duplicado"}
      </AlertTitle>
      <AlertDescription className="text-body-sm">
        Coincide en {coincidencia.campos.join(", ")} con{" "}
        <strong>{ex?.empresa ?? "un lead existente"}</strong>
        {ex?.contacto ? ` (${ex.contacto})` : ""}
        {ex?.estado ? ` · estado ${ex.estado}` : ""}. Revisa la cartera antes de
        crear un registro nuevo.
      </AlertDescription>
    </Alert>
  );
}
