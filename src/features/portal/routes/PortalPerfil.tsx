import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, KeyRound, User as UserIcon, Building2 } from "lucide-react";
import { usePortalPerfil } from "@/features/portal/hooks";
import { EditarContactoDialog } from "@/features/portal/components/perfil/EditarContactoDialog";
import { CambiarPasswordDialog } from "@/features/portal/components/perfil/CambiarPasswordDialog";
import { PortalPageShell } from "@/features/portal/components/layout/PortalPageShell";
import { PerfilAsyncFallback } from "@/features/portal/components/perfil/PerfilAsyncFallback";
import { useDocumentTitle } from "@/hooks/shared";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground break-words">
        {value && value.length > 0 ? value : <span className="text-muted-foreground">—</span>}
      </p>
    </div>
  );
}

export default function PortalPerfil() {
  useDocumentTitle('Mi perfil');
  const { data, isLoading, isError, refetch } = usePortalPerfil();
  const [editContacto, setEditContacto] = useState(false);
  const [cambiarPass, setCambiarPass] = useState(false);

  // UX-05 / UIB-05: patrón canónico AsyncBoundary (skeleton + Reintentar).
  const falla = isError || !data;
  if (isLoading) return <PerfilAsyncFallback isLoading onRetry={() => void refetch()} />;
  if (falla) return <PerfilAsyncFallback isError onRetry={() => void refetch()} />;

  const { email, cliente } = data;

  return (
    <PortalPageShell
      className="max-w-3xl mx-auto"
      icon={<UserIcon className="h-6 w-6 text-accent" />}
      title="Mi Perfil"
      description="Datos de tu cuenta y empresa."
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-accent" /> Datos personales
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Correo electrónico" value={email} />
          <Field label="Rol" value="Cliente" />
          <div className="sm:col-span-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setCambiarPass(true)}>
              <KeyRound className="h-4 w-4 mr-1.5" /> Cambiar contraseña
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Empresa vinculada
          </CardTitle>
          {cliente && (
            <Button variant="outline" size="sm" onClick={() => setEditContacto(true)}>
              <Pencil className="h-4 w-4 mr-1.5" /> Editar contacto
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Razón social" value={cliente?.nombre} />
          <Field label="RFC" value={cliente?.rfc} />
          <Field label="Contacto" value={cliente?.contacto} />
          <Field label="Teléfono" value={cliente?.telefono} />
          <Field label="Email de la empresa" value={cliente?.email} />
          <Field label="Ciudad" value={cliente?.ciudad} />
          <div className="sm:col-span-2">
            <Field
              label="Dirección"
              value={
                [cliente?.direccion, cliente?.ciudad, cliente?.estado, cliente?.cp]
                  .filter((s) => s && s.length > 0)
                  .join(", ")
              }
            />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ¿Necesitas actualizar tu razón social, RFC o dirección fiscal? Contacta a tu ejecutivo
        para que actualice estos datos.
      </p>

      {cliente && (
        <EditarContactoDialog
          open={editContacto}
          onOpenChange={setEditContacto}
          contactoActual={cliente.contacto}
          telefonoActual={cliente.telefono}
        />
      )}
      <CambiarPasswordDialog open={cambiarPass} onOpenChange={setCambiarPass} />
    </PortalPageShell>
  );
}
