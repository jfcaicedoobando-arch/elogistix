/**
 * Aviso del ciclo de vida del prospecto en la ficha del lead.
 *
 * Regla de negocio (Libre Carga): un lead calificado al que se le cotiza NO es
 * cliente. Sólo un rol autorizado puede darlo de alta desde el módulo oficial
 * de Clientes, con las validaciones fiscales completas.
 */
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, UserPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { CrmLeadEstado } from "@/features/crm/hooks";

interface Props {
  estado: CrmLeadEstado;
  /** Sólo roles con permiso de alta de clientes ven el botón. */
  canAltaCliente: boolean;
}

export default function LeadEtapaProspectoAviso({ estado, canAltaCliente }: Props) {
  const navigate = useNavigate();

  if (estado === "Prospecto") {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Prospecto en cotización</AlertTitle>
        <AlertDescription>
          Este prospecto ya está calificado y puede recibir cotizaciones, pero todavía
          no es cliente: no se le pueden crear embarques ni facturas.
        </AlertDescription>
      </Alert>
    );
  }

  if (estado !== "Pendiente de alta") return null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Pendiente de alta como cliente</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Aceptó una cotización, pero sigue sin ser cliente. Antes de operar hay que
          darlo de alta en el módulo de Clientes con sus datos fiscales completos y
          luego vincularlo a la oportunidad.
        </p>
        {canAltaCliente ? (
          <Button size="sm" variant="outline" onClick={() => navigate(ROUTES.CLIENTES)}>
            <UserPlus className="h-4 w-4 mr-1" />
            Dar de alta como cliente
          </Button>
        ) : (
          <p className="text-label">
            Tu rol no puede dar de alta clientes. Solicítalo a un administrador o al
            área de operaciones.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
