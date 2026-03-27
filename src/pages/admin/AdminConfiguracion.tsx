import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, Globe, CreditCard, Shield } from "lucide-react";

export default function AdminConfiguracion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6" />
          Configuración Global
        </h1>
        <p className="text-muted-foreground mt-1">
          Parámetros globales de la plataforma que aplican a todas las organizaciones.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-4 w-4" />
              Plataforma
            </CardTitle>
            <CardDescription>Nombre, logo y configuración general</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Próximamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Planes y Facturación
            </CardTitle>
            <CardDescription>Gestión de planes y suscripciones</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Próximamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              Seguridad
            </CardTitle>
            <CardDescription>Políticas de seguridad globales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Próximamente</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
