import { memo } from "react";
import { Building2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { useCopyText } from "@/hooks/shared";

/**
 * Tarjeta read-only que muestra los datos de identificación de la
 * organización (tenant) actual: nombre, ID, plan y estado. Sirve para que
 * cualquier admin sepa en qué cuenta está y pueda copiar el ID al pedir
 * soporte. No edita nada — los datos editables (nombre comercial, RFC, etc.
 * que aparecen en PDFs) viven en la tarjeta "Datos de la Empresa" debajo.
 */
function OrgInfoCardBase() {
  const { organization } = useOrganization();
  const copy = useCopyText();
  if (!organization) return null;

  const copiarId = () => {
    void copy(organization.id, {
      successMessage: "ID de organización copiado",
      errorTitle: "No se pudo copiar el ID",
      method: "OrgInfoCard.copiarId",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" /> Organización
        </CardTitle>
        <CardDescription>
          Tu cuenta tenant en Libre Carga. Estos datos los administra el equipo
          de Libre Carga; comparte el ID si necesitas soporte.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Nombre</div>
          <div className="font-medium">{organization.nombre}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Plan</div>
          <div>
            <Badge variant="secondary" className="font-normal">{organization.plan || "—"}</Badge>
            {!organization.activo && (
              <Badge variant="destructive" className="ml-2 font-normal">Inactiva</Badge>
            )}
          </div>
        </div>
        <div className="space-y-1 md:col-span-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">ID de organización</div>
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 rounded bg-muted text-xs font-mono truncate">{organization.id}</code>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copiarId} aria-label="Copiar ID">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const OrgInfoCard = memo(OrgInfoCardBase);
