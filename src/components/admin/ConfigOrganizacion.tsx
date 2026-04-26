import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useConfiguracionByOrg } from "@/hooks/useConfiguracionOrg";

export default function ConfigOrganizacion() {
  const { organizations } = useOrganization();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const { data: configItems = [], isLoading } = useConfiguracionByOrg(selectedOrgId || null);

  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  const grouped = configItems.reduce<Record<string, typeof configItems>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Configuración por Organización
        </CardTitle>
        <CardDescription>Selecciona una organización para ver y gestionar su configuración</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-80">
            <SelectValue placeholder="Seleccionar organización..." />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                <div className="flex items-center gap-2">
                  {org.nombre}
                  <Badge variant="outline" className="text-[10px]">{org.plan}</Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedOrgId && !isLoading && configItems.length === 0 && (
          <p className="text-sm text-muted-foreground py-4">Esta organización no tiene configuración personalizada.</p>
        )}

        {selectedOrgId && isLoading && (
          <p className="text-sm text-muted-foreground py-4">Cargando configuración...</p>
        )}

        {Object.entries(grouped).map(([categoria, items]) => (
          <div key={categoria} className="space-y-2">
            <h4 className="text-sm font-semibold capitalize text-muted-foreground">{categoria}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{item.clave.replace(/_/g, " ")}</p>
                      {item.descripcion && (
                        <p className="text-xs text-muted-foreground">{item.descripcion}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {typeof item.valor === "string" ? item.valor : JSON.stringify(item.valor)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
