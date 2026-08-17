/**
 * Encabezados de la tabla de partidas capturadas a mano (v13.629.0).
 * Sólo visible en pantallas medianas: en móvil cada renglón usa etiquetas.
 */
export function ConceptosTablaHeader() {
  return (
    <div className="hidden grid-cols-24 gap-2 px-2 text-2xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
      <span className="col-span-8">Descripción</span>
      <span className="col-span-2 text-right">Cant.</span>
      <span className="col-span-4 text-right">Precio unit.</span>
      <span className="col-span-3 text-right">IVA</span>
      <span className="col-span-2">Unidad</span>
      <span className="col-span-3 text-right">Total línea</span>
      <span className="col-span-2" />
    </div>
  );
}
