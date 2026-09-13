/**
 * Tarjetas auxiliares del detalle de cotización: banner de prospecto,
 * comentario del cliente y notas. Extraídas de `CotizacionDetalle.tsx`
 * para reducir complejidad y mantener el archivo principal delgado.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { separarNotas } from "@/lib/domain/notasVisibilidad";

interface ProspectoBannerProps {
  empresa: string | null;
  contacto: string | null;
  email: string | null;
  telefono: string | null;
}

export function ProspectoBanner({ empresa, contacto, email, telefono }: ProspectoBannerProps) {
  return (
    <Card className="border-warning/30 bg-warning/10">
      <CardContent className="p-4">
        <p className="text-body font-medium [color:hsl(var(--warning))] mb-2">
          Datos del Prospecto — Convierte a cliente primero para poder generar embarques
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-body">
          <div><span className="text-muted-foreground">Empresa</span><p className="font-medium">{empresa}</p></div>
          <div><span className="text-muted-foreground">Contacto</span><p className="font-medium">{contacto}</p></div>
          <div><span className="text-muted-foreground">Email</span><p className="font-medium">{email || '-'}</p></div>
          <div><span className="text-warning">Teléfono</span><p className="font-medium text-warning">{telefono || '-'}</p></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComentarioClienteCard({ texto }: { texto: string }) {
  return (
    <Card className="border-info/50">
      <CardHeader><CardTitle>Comentario del Cliente</CardTitle></CardHeader>
      <CardContent>
        <p className="text-body whitespace-pre-wrap italic">"{texto}"</p>
      </CardContent>
    </Card>
  );
}

/**
 * v13.823.341 — separa lo que ve el cliente de lo que es sólo para el equipo.
 * Las notas internas se muestran etiquetadas aquí y quedan fuera del PDF y del
 * correo (ver `notasVisibilidad.ts`).
 */
export function NotasCard({ texto }: { texto: string }) {
  const { cliente, internas } = separarNotas(texto);
  if (!cliente && !internas) return null;
  return (
    <Card>
      <CardHeader><CardTitle>Notas</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {cliente && (
          <div>
            <p className="text-body-sm text-muted-foreground mb-1">Para el cliente</p>
            <p className="text-body whitespace-pre-wrap">{cliente}</p>
          </div>
        )}
        {internas && (
          <div className="rounded-md border border-dashed bg-muted/30 p-3">
            <Badge variant="outline" className="mb-1 text-label">Nota interna</Badge>
            <p className="text-body whitespace-pre-wrap">{internas}</p>
            <p className="text-body-sm text-muted-foreground mt-1">
              No se incluye en la cotización que recibe el cliente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
