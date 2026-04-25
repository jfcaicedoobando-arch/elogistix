import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings } from "lucide-react";

interface ConfigItem {
  id: string;
  clave: string;
  descripcion?: string | null;
  valor: unknown;
}

interface OrgConfigCardProps {
  loading: boolean;
  totalItems: number;
  grouped: Record<string, ConfigItem[]>;
}

export function OrgConfigCard({ loading, totalItems, grouped }: OrgConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Settings className="h-5 w-5" /> Configuración
        </CardTitle>
        <CardDescription>Parámetros de configuración de esta organización</CardDescription>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Cargando...</p>}
        {!loading && totalItems === 0 && (
          <p className="text-sm text-muted-foreground">Sin configuración personalizada.</p>
        )}
        {Object.entries(grouped).map(([categoria, items]) => (
          <div key={categoria} className="mb-4 space-y-2">
            <h4 className="text-sm font-semibold capitalize text-muted-foreground">{categoria}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium">{item.clave.replace(/_/g, " ")}</p>
                      {item.descripcion && <p className="text-xs text-muted-foreground">{item.descripcion}</p>}
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
