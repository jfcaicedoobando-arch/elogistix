/** Tarjeta "Saldo a favor (anticipos)" en el detalle del proveedor. */
import { useState } from "react";
import { HandCoins, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { useAnticiposDisponibles } from "@/features/anticipos-proveedor/hooks/useAnticiposDisponibles";
import { RegistrarAnticipoDialog } from "./RegistrarAnticipoDialog";

interface Props {
  proveedorId: string;
  proveedorNombre: string;
  canEdit: boolean;
}

export function ProveedorAnticiposCard({ proveedorId, proveedorNombre, canEdit }: Props) {
  const [open, setOpen] = useState(false);
  const { data: anticipos, porMoneda, isLoading } = useAnticiposDisponibles(proveedorId);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 py-4">
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="h-4 w-4 text-accent" />
            Saldo a favor (anticipos)
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Registrar anticipo
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando anticipos…</p>
          ) : anticipos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin anticipos pendientes de aplicar. Registra uno cuando el proveedor pida el pago antes de la factura.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                {porMoneda.map((m) => (
                  <div key={m.moneda}>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{m.moneda}</p>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(m.disponible, m.moneda)}
                    </p>
                  </div>
                ))}
              </div>
              <ul className="divide-y divide-border text-sm">
                {anticipos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="text-muted-foreground">
                      {formatDate(a.fecha_anticipo)}
                      {a.referencia ? ` · Ref. ${a.referencia}` : ""}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(a.disponible, a.moneda)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <RegistrarAnticipoDialog
        open={open}
        onOpenChange={setOpen}
        proveedorIdInicial={proveedorId}
        proveedorNombreInicial={proveedorNombre}
      />
    </>
  );
}
