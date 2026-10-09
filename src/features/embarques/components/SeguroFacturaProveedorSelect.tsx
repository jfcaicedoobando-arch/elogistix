/** Hallazgo 148 — Optional link. Saved IDs survive unavailable or incomplete lists. */
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFacturasSeguroElegibles, type FacturasSeguroContext } from "@/features/embarques/hooks/useFacturasSeguroElegibles";
import { SEGURO_FACTURA_SELECTOR_ERROR } from "../domain/seguroFacturaSelector";

const SIN = "sin";
interface Props extends FacturasSeguroContext {
  value: string | null;
  savedValue?: string | null;
  onChange: (id: string | null) => void;
}

export function SeguroFacturaProveedorSelect({ value, savedValue, onChange, ...context }: Props) {
  const query = useFacturasSeguroElegibles(context);
  const seleccionAusente = value !== null && !query.items.some((factura) => factura.id === value);
  const saved = value === savedValue;
  const loading = query.isLoading || query.isRefetching;
  const blocked = query.unavailable || loading || (query.isError && !query.isFetchNextPageError);

  return (
    <div className="sm:col-span-2">
      <Label htmlFor="seguro-factura">Factura de proveedor que documenta la prima (opcional)</Label>
      <Select value={value ?? SIN} onValueChange={(v) => onChange(v === SIN ? null : v)} disabled={blocked}>
        <SelectTrigger id="seguro-factura"><SelectValue placeholder="Sin factura ligada" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN}>Sin factura ligada (la prima cuenta como costo)</SelectItem>
          {seleccionAusente && (
            <SelectItem value={value}>{saved ? "Factura ligada guardada" : "Factura seleccionada"} · información no disponible en esta lista</SelectItem>
          )}
          {query.items.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {(f.folio_interno ?? "Sin folio")} · {f.proveedor_nombre ?? "Sin proveedor"} · Subtotal de factura: {f.subtotal} {f.moneda}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-body-sm text-muted-foreground mt-1">
        La cobertura completa se comprueba al consultar y se valida de nuevo al guardar.
        El subtotal mostrado es el de la factura. Seleccionarla no la reserva.
      </p>
      <SeguroFacturaCarga query={query} />
      <SeguroFacturaPaginas query={query} />
      {seleccionAusente && (
        <p className="text-body-sm text-muted-foreground mt-1">
          {saved ? "Se conserva el vínculo guardado." : "Se conserva la selección."} Su ausencia en esta lista no permite determinar su vigencia ni su cobertura.
        </p>
      )}
    </div>
  );
}


type QueryProps = { query: ReturnType<typeof useFacturasSeguroElegibles> };

function SeguroFacturaCarga({ query }: QueryProps) {
  return <>
    {(query.isLoading || query.isRefetching) && <p className="text-body-sm text-muted-foreground mt-1">Cargando facturas; se conserva la selección.</p>}
    {(query.isError || query.unavailable) && <p role="alert" className="text-body-sm text-muted-foreground mt-1">{SEGURO_FACTURA_SELECTOR_ERROR}</p>}
    {query.isFetchNextPageError && <p className="text-body-sm text-muted-foreground mt-1">La lista está incompleta. Puedes reintentar cargar más.</p>}
    {query.complete && query.items.length === 0 && (
      <EmptyStateInline density="compact" message="No hay facturas elegibles para estos datos." />
    )}
  </>;
}

function SeguroFacturaPaginas({ query }: QueryProps) {
  if (query.unavailable) return null;
  return <>
    {query.isError && !query.isFetchNextPageError && (
      <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>Reintentar carga</Button>
    )}
    {(query.hasNextPage || query.isFetchNextPageError) && (
      <Button type="button" variant="outline" size="sm" disabled={query.isFetching}
        onClick={() => void query.fetchNextPage()}>
        {query.isFetchingNextPage ? "Cargando más…" : query.isFetchNextPageError ? "Reintentar cargar más" : "Cargar más facturas"}
      </Button>
    )}
  </>;
}
