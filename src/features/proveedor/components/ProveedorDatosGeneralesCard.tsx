/**
 * Card "Datos generales" del detalle de proveedor.
 *
 * v13.320.65 — Extraído de `ProveedorDetalle.tsx`. Usa `DescriptionList` para
 * que los campos vacíos muestren "—" en vez de renderizarse en blanco, y hace
 * accionables el email (`mailto:`) y el teléfono (`tel:`).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DescriptionList, type DescriptionItem } from "@/components/shared/DescriptionList";
import { toTitleCase, formatPhoneMx } from "@/lib/formatters";

interface Props {
  rfc: string | null | undefined;
  contacto: string | null | undefined;
  email: string | null | undefined;
  telefono: string | null | undefined;
  monedaPreferida: string | null | undefined;
}

export function ProveedorDatosGeneralesCard({
  rfc, contacto, email, telefono, monedaPreferida,
}: Props) {
  const telFmt = formatPhoneMx(telefono);
  const items: DescriptionItem[] = [
    { label: "RFC / Tax ID", value: (rfc || "").toUpperCase(), mono: true },
    { label: "Contacto", value: toTitleCase(contacto) },
    {
      label: "Email",
      value: email ? (
        <a href={`mailto:${email}`} className="text-accent hover:underline">
          {email}
        </a>
      ) : null,
    },
    {
      label: "Teléfono",
      value: telefono ? (
        <a href={`tel:${telefono}`} className="text-accent hover:underline">
          {telFmt}
        </a>
      ) : null,
    },
    { label: "Moneda preferida", value: monedaPreferida },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle>Datos generales</CardTitle>
      </CardHeader>
      <CardContent>
        <DescriptionList items={items} columns={2} />
      </CardContent>
    </Card>
  );
}
