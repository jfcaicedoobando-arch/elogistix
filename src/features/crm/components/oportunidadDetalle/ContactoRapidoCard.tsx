import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ContactActions from "@/features/crm/components/ContactActions";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Contacto {
  nombre?: string | null;
  email?: string | null;
  telefono?: string | null;
}

interface Props {
  contacto: Contacto | undefined;
  oportunidadId: string;
  clienteNombre?: string | null;
  vendedorEmail?: string | null;
  etapaNombre?: string;
  montoEstimado: number;
  moneda: string;
}

export function ContactoRapidoCard({
  contacto,
  oportunidadId,
  clienteNombre,
  vendedorEmail,
  etapaNombre,
  montoEstimado,
  moneda,
}: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Contacto rápido</CardTitle>
      </CardHeader>
      <CardContent>
        {contacto ? (
          <ContactActions
            email={contacto.email ?? undefined}
            telefono={contacto.telefono ?? undefined}
            plantillaCtx={{
              entidadTipo: "oportunidad",
              entidadId: oportunidadId,
              vars: {
                contacto: contacto.nombre || clienteNombre || "",
                empresa: clienteNombre || "",
                vendedor: vendedorEmail ?? "",
                etapa: etapaNombre ?? "",
                monto: formatCurrencyCompact(montoEstimado, moneda),
              },
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">El cliente no tiene contactos registrados.</p>
        )}
      </CardContent>
    </Card>
  );
}
