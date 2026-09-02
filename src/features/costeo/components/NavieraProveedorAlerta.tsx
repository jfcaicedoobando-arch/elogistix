/**
 * Aviso cuando no hay proveedores tipo "Naviera" para vincular condiciones.
 *
 * El agente no tiene acceso al módulo de Proveedores: sólo se le explica que
 * Operaciones debe vincular el proveedor antes de continuar (sin CTA a rutas
 * que no puede ver). Roles internos con acceso a `/compras/proveedores` ven
 * un CTA que abre el directorio filtrado por tipo "Naviera".
 */
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/contexts/AuthContext";
import { hasRouteAccess } from "@/lib/access/roleRouteMatrix";
import { ROUTES } from "@/constants/routes";

export function NavieraProveedorAlerta() {
  const { effectiveRole } = useAuth();
  const puedeIrAProveedores = hasRouteAccess(effectiveRole, ROUTES.COMPRAS_PROVEEDORES);

  return (
    <Alert variant="destructive" data-testid="naviera-proveedor-alerta">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Falta vincular el proveedor de esta naviera</AlertTitle>
      <AlertDescription className="space-y-2">
        {puedeIrAProveedores ? (
          <>
            <p>
              Para configurar condiciones necesitas un proveedor tipo &quot;Naviera&quot; en el
              directorio. Créalo y vuelve a esta pantalla para vincularlo.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link
                to={`${ROUTES.COMPRAS_PROVEEDORES}?tipo=Naviera&nuevo=1`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Crear proveedor Naviera
              </Link>
            </Button>
            <p className="text-xs opacity-75">
              Se abre en una pestaña nueva; al terminar, regresa a esta pestaña y vuelve a abrir
              la configuración de la naviera.
            </p>
          </>
        ) : (
          <p>
            Pide a Operaciones que dé de alta y vincule el proveedor tipo &quot;Naviera&quot;
            correspondiente antes de configurar estas condiciones.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
