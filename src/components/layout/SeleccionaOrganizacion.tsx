import { memo } from "react";
import { Building2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

/**
 * Estado vacío para el super admin cuando abre un módulo operativo sin haber
 * elegido una organización. Evita mostrar datos de un cliente al azar.
 */
function SeleccionaOrganizacionBase() {
  const {
    organizations,
    setActiveOrganization,
    errorOrganizaciones,
    reintentarCargaOrganizaciones,
  } = useOrganization();

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardContent className="space-y-4 py-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Elige la organización que quieres administrar</h2>
          <p className="text-sm text-muted-foreground">
            Como administrador de Libre Carga no perteneces a ninguna organización.
            Selecciona un cliente para ver sus datos operativos.
          </p>
        </div>
        <div className="mx-auto flex max-h-64 flex-col gap-2 overflow-auto text-left">
          {organizations.map((org) => (
            <Button
              key={org.id}
              variant="outline"
              className="justify-start gap-2"
              onClick={() => setActiveOrganization(org.id)}
            >
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{org.nombre}</span>
            </Button>
          ))}
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={ROUTES.ADMIN_ORGANIZACIONES}>Ir a la consola de plataforma</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export const SeleccionaOrganizacion = memo(SeleccionaOrganizacionBase);
