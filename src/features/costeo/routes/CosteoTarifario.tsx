/** Tarifario: tarifas vigentes, cargos FOB y cargos locales de revalidación. */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { esRolPricing } from "@/features/crm/services/pricing/permisosPricing";
import { TarifasBaseTab } from "@/features/costeo/tarifario/TarifasBaseTab";
import { CargosTab } from "@/features/costeo/tarifario/CargosTab";

export default function CosteoTarifario() {
  const { effectiveRole } = useAuth();
  const { organizationId } = useOrganization();
  const puedeEditar = esRolPricing(effectiveRole);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-h2 font-semibold">Tarifario</h1>
        <p className="text-body-sm text-muted-foreground">Tarifas vigentes disponibles al instante para las solicitudes de pricing.</p>
      </div>
      <Tabs defaultValue="tarifas">
        <TabsList>
          <TabsTrigger value="tarifas">Tarifas (Puertos base)</TabsTrigger>
          <TabsTrigger value="fob">Cargos FOB de agentes</TabsTrigger>
          <TabsTrigger value="locales">Cargos locales en México (revalidación)</TabsTrigger>
        </TabsList>
        <TabsContent value="tarifas"><TarifasBaseTab puedeEditar={puedeEditar} /></TabsContent>
        <TabsContent value="fob"><CargosTab tipo="fob" orgId={organizationId} puedeEditar={puedeEditar} /></TabsContent>
        <TabsContent value="locales"><CargosTab tipo="locales" orgId={organizationId} puedeEditar={puedeEditar} /></TabsContent>
      </Tabs>
    </div>
  );
}
