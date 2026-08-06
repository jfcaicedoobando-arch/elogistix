/**
 * Card "Facturar a" con los datos completos del cliente (RFC + dirección).
 * Enlaza al expediente del cliente cuando conocemos su id.
 */
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ProformaClienteFull } from "@/features/proformas/services";

interface Props {
  cliente: ProformaClienteFull | null;
  clienteNombreFallback: string;
  clienteId?: string | null;
}

export function ClienteBillToCard({ cliente, clienteNombreFallback, clienteId }: Props) {
  const nombre = cliente?.nombre?.trim() || clienteNombreFallback;
  const rfc = cliente?.rfc?.trim() || null;
  const partes = cliente
    ? [cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp].filter(Boolean).map(String)
    : [];
  const direccion = partes.length > 0 ? partes.join(", ") : null;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle>Facturar a</CardTitle>
        {clienteId && (
          <Button variant="link" size="sm" asChild className="h-auto p-0 text-xs shrink-0">
            <Link to={`/clientes/${clienteId}`} className="inline-flex items-center gap-1">
              Ver cliente <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        )}
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
