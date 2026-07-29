/**
 * Pantalla mostrada cuando la cuenta del portal no tiene ninguna empresa
 * vinculada. Evita dashboards vacíos sin explicación (P-07).
 */
import { Building2, LogOut, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  email?: string | null;
  onSignOut: () => void;
}

export function PortalSinCliente({ email, onSignOut }: Props) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="h-6 w-6" aria-hidden />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Tu cuenta aún no está vinculada a una empresa</h1>
            <p className="text-sm text-muted-foreground">
              Ya iniciaste sesión{email ? ` como ${email}` : ""}, pero tu usuario todavía no está
              asociado a un cliente. En cuanto tu ejecutivo lo active verás aquí tus embarques,
              cotizaciones y facturas.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild variant="outline">
              <a href="mailto:hola@librecarga.com">
                <Mail className="h-4 w-4 mr-1" aria-hidden /> Contactar a mi ejecutivo
              </a>
            </Button>
            <Button variant="ghost" onClick={onSignOut}>
              <LogOut className="h-4 w-4 mr-1" aria-hidden /> Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
