import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, UserPlus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NuevoUsuarioDialog from "@/features/admin/components/usuario/NuevoUsuarioDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import {
  useUsuarios,
  useUsuariosPortalCliente,
  useUsuariosPortalAgente,
} from "@/features/admin/hooks/usuario";
import { UsuariosInternosTab } from "./UsuariosInternosTab";
import { PortalUsuariosTab } from "./PortalUsuariosTab";
import { useDocumentTitle } from "@/hooks/shared";

type TabId = "internos" | "cliente" | "agente";

export default function Usuarios() {
  useDocumentTitle('Gestión de usuarios');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("internos");

  const { data: internos = [] } = useUsuarios();
  const { data: portalCliente = [] } = useUsuariosPortalCliente();
  const { data: portalAgente = [] } = useUsuariosPortalAgente();

  return (
    <PageContainer>
      <PageHeader
        icon={<ShieldCheck className="h-6 w-6 text-primary" />}
        title="Gestión de Usuarios"
        description="Administra usuarios internos y accesos a los portales de clientes y agentes."
        actions={
          tab === "internos" ? (
            <Button onClick={() => setDialogOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Nuevo Usuario
            </Button>
          ) : null
        }
      />

      <NuevoUsuarioDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={() => {
          /* invalidación automática vía useCreateUser */
        }}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="internos">
            Internos <span className="ml-1 text-xs text-muted-foreground">({internos.length})</span>
          </TabsTrigger>
          <TabsTrigger value="cliente">
            Portal Cliente{" "}
            <span className="ml-1 text-xs text-muted-foreground">({portalCliente.length})</span>
          </TabsTrigger>
          <TabsTrigger value="agente">
            Portal Agente{" "}
            <span className="ml-1 text-xs text-muted-foreground">({portalAgente.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="internos">
          <UsuariosInternosTab />
        </TabsContent>

        <TabsContent value="cliente">
          <PortalUsuariosTab tipo="cliente" />
        </TabsContent>

        <TabsContent value="agente">
          <PortalUsuariosTab tipo="agente" />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
