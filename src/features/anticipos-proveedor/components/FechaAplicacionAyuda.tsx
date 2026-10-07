/** Contexto visible de las fechas civiles sin corregir la captura del usuario. */
export function FechaAplicacionAyuda({ minima, error }: { minima?: string; error: string | null }) {
  return <>
    <p className="text-xs text-muted-foreground">Fecha mínima: {minima ?? "selecciona un anticipo"}.</p>
    {error && <p className="text-xs text-destructive">{error}</p>}
  </>;
}
