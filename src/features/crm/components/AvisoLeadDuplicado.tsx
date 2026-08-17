/**
 * Aviso de lead duplicado en alta manual (v13.630.0 — Ola A CRM).
 * No bloquea: informa contra qué lead existente coincide para evitar
 * cartera sucia (mismo prospecto capturado por dos vendedores).
 */
import { Copy } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDuplicadoLead } from "@/features/crm/hooks/useLeadsDuplicados";

interface Props {
  empresa: string;
  email: string;
  telefono: string;
}

export function AvisoLeadDuplicado({ empresa, email, telefono }: Props) {
  const { coincidencia } = useDuplicadoLead({ empresa, email, telefono });
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
      <AlertDescription className="text-xs">
        Coincide en {coincidencia.campos.join(", ")} con{" "}
        <strong>{ex?.empresa ?? "un lead existente"}</strong>
        {ex?.contacto ? ` (${ex.contacto})` : ""}
        {ex?.estado ? ` · estado ${ex.estado}` : ""}. Revisa la cartera antes de
        crear un registro nuevo.
      </AlertDescription>
    </Alert>
  );
}
