/**
 * Cuerpos del wizard de sustitución (motivo SAT 01). Separados de
 * `DialogSustituirFactura` para respetar el límite de 200 líneas.
 */
export function IntroBody({
  numero,
  uuidOriginal,
}: { numero?: string; uuidOriginal?: string | null }) {
  return (
    <div className="space-y-3 text-body">
      <p>
        Se clonará la factura <strong>{numero}</strong> como un nuevo borrador. Al confirmar,
        te llevaremos directamente al detalle del borrador para que lo edites y timbres.
        Cuando vuelvas aquí, este diálogo reabrirá en el paso final para cancelar la original.
      </p>
      <ol className="list-decimal list-inside text-muted-foreground space-y-1">
        <li>Crear borrador sustituto y navegar a él.</li>
        <li>Editar y timbrar el nuevo CFDI (en esta misma pestaña).</li>
        <li>Volver a esta factura y confirmar cancelación (motivo 01).</li>
      </ol>
      {!uuidOriginal && (
        <p className="text-destructive text-body-sm">
          Esta factura no tiene UUID fiscal; no se puede sustituir.
        </p>
      )}
    </div>
  );
}

export function ConfirmarBody({
  numero, isLoading, timbrada, estadoLabel,
}: { numero?: string; isLoading: boolean; timbrada: boolean; estadoLabel: string }) {
  return (
    <div className="space-y-3 text-body">
      <p>
        Ya existe un borrador sustituto para esta factura. Cuando esté timbrado,
        cancelaremos el CFDI <strong>{numero}</strong> con motivo SAT 01 referenciando
        al UUID de la sustituta.
      </p>
      <div className={`rounded-md border p-3 text-body-sm ${timbrada ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
        <strong>Estado de la sustituta:</strong>{" "}
        {isLoading ? "Consultando…" : estadoLabel}
        {!timbrada && !isLoading && (
          <div className="mt-1 text-muted-foreground">
            Debe estar timbrada antes de cancelar la original.
          </div>
        )}
      </div>
      <div className="rounded-md border border-warning/30 bg-warning/5 p-3 text-body-sm">
        <strong>Nota:</strong> el SAT puede tardar hasta 72 h en aceptar la cancelación si el
        CFDI supera $1,000 MXN (regla 2.7.1.34). El sistema hará seguimiento automático.
      </div>
    </div>
  );
}
