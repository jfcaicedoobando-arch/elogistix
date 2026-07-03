/**
 * Card "Facturar a" con los datos completos del cliente (RFC + dirección).
 * Fallback al `cliente_nombre` de la proforma cuando no hay `cliente_full`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProformaClienteFull } from "@/features/proformas/services";

interface Props {
  cliente: ProformaClienteFull | null;
  clienteNombreFallback: string;
}

export function ClienteBillToCard({ cliente, clienteNombreFallback }: Props) {
  const nombre = cliente?.nombre?.trim() || clienteNombreFallback;
  const rfc = cliente?.rfc?.trim() || null;
  const partes = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).map(String)
    : [];
  const direccion = partes.length > 0 ? partes.join(", ") : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Facturar a</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p className="font-medium break-words" title={nombre}>{nombre}</p>
        <div>
          <p className="text-xs text-muted-foreground">RFC</p>
          <p className="font-mono">{rfc || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Dirección</p>
          <p className="whitespace-pre-line break-words">{direccion || "—"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
