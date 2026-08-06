/**
 * Tarjetas auxiliares del detalle de cotización: banner de prospecto,
 * comentario del cliente y notas. Extraídas de `CotizacionDetalle.tsx`
 * para reducir complejidad y mantener el archivo principal delgado.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        <p className="text-sm font-medium [color:hsl(var(--warning))] mb-2">
          Datos del Prospecto — Convierte a cliente primero para poder generar embarques
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
      <CardHeader><CardTitle >Comentario del Cliente</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap italic">"{texto}"</p>
      </CardContent>
    </Card>
  );
}

export function NotasCard({ texto }: { texto: string }) {
  return (
    <Card>
      <CardHeader><CardTitle >Notas</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm whitespace-pre-wrap">{texto}</p>
      </CardContent>
    </Card>
  );
}
