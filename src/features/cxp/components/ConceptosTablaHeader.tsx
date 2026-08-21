/**
 * Encabezados de la tabla de partidas capturadas a mano (v13.629.0).
 * Sólo visible en pantallas medianas: en móvil cada renglón usa etiquetas.
 */
export function ConceptosTablaHeader() {
  return (
    <div className="hidden items-center gap-2 px-2 text-overline font-medium md:flex">
      <span className="flex-1">Descripción</span>
      <span className="w-16 text-right">Cant.</span>
      <span className="w-24 text-right">Precio</span>
      <span className="w-20 text-right">IVA</span>
      <span className="w-16">Unidad</span>
      <span className="w-24 text-right">Total línea</span>
      <span className="w-16" />
    </div>
  );
}
