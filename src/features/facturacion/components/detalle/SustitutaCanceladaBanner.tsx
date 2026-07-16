/**
 * SustitutaCanceladaBanner — se muestra cuando la factura tiene `sustituida_por`
 * apuntando a una sustituta que fue cancelada. Informa al usuario que la
 * factura original vuelve a estar disponible para cancelarse o sustituirse.
 */
import { Link } from "react-router-dom";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  sustitutaId: string;
  sustitutaNumero: string | null;
}

export function SustitutaCanceladaBanner({ sustitutaId, sustitutaNumero }: Props) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Sustituta cancelada</AlertTitle>
      <AlertDescription>
        La factura sustituta {sustitutaNumero ?? ""} fue cancelada, por lo que esta factura
        vuelve a estar disponible para cancelarse o sustituirse nuevamente.{" "}
        <Link
          to={`/facturacion/${sustitutaId}`}
          className="inline-flex items-center gap-1 underline underline-offset-2"
        >
          Ver sustituta <ExternalLink className="h-3 w-3" />
        </Link>
      </AlertDescription>
    </Alert>
  );
}
