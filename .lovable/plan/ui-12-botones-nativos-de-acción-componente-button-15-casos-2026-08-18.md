# UI-12 — Botones nativos de acción → componente `Button` (15 casos)

Verifiqué los 12 archivos del paquete: los 15 `<button>` nativos siguen ahí, así que el cambio está pendiente.

## Qué se gana

Hoy esos botones son etiquetas HTML crudas con estilos a mano. Al usar el `Button` del sistema de diseño heredan foco visible por teclado, área de toque consistente y estado deshabilitado uniforme, como todos los demás botones de la app. Es como reemplazar tornillos sueltos por piezas del mismo kit: se ve casi igual, pero encaja parejo.

## Botones a migrar

| Archivo | Acción |
|---|---|
| `admin/routes/AdminDemoLeads.tsx` | Copiar email / copiar teléfono |
| `anticipos-proveedor/routes/_sections/buildAnticipoColumns.tsx` | Ir al embarque |
| `anticipos-proveedor/components/EmbarqueAnticipoPicker.tsx` | Seleccionar embarque |
| `compras/routes/_sections/ConciliacionDetalleFilaRenglon.tsx` | Expandir/colapsar partidas |
| `cotizacion/components/seccionDestinatario/BuscadorProspectos.tsx` | Seleccionar prospecto |
| `cxp/components/SugerirEmbarqueBlock.tsx` | Vincular embarque sugerido |
| `cxp/components/CargaCfdiSection.tsx` | Quitar XML / quitar PDF |
| `cxp/components/CargaPdfIaSection.tsx` | Quitar PDF |
| `cxp/components/CargaXmlNcSection.tsx` | Quitar XML / quitar PDF |
| `facturacion/components/NotasCreditoRecientes.tsx` | Colapsar/expandir tarjeta |
| `facturacion/components/ContactosClienteList.tsx` | Elegir contacto de envío |
| `operaciones/components/OperadorCard.tsx` | Abrir detalle por estado |

## Cómo se convierten

- Filas/listas full-width: `variant="ghost"` + `h-auto w-full justify-start whitespace-normal font-normal`.
- Botones de "quitar archivo": `size="icon"` compacto (`h-7 w-7`).
- Botones de texto en celda: `p-0 h-auto` conservando el hover equivalente.
- Se conserva cada `onClick` (incluido `stopPropagation` donde ya existía) y se agrega `type="button"` y `aria-label` donde falten.

## Detalles técnicos y riesgos aceptados

- El `Button` fuerza `[&_svg]:size-4`: iconos declarados `h-3 w-3` pasan a 16 px dentro de estos botones (imperceptible; se revisa visualmente `AdminDemoLeads` y `OperadorCard`).
- `Button` deshabilitado usa `pointer-events-none`, así que en `OperadorCard` el tooltip nativo `title` del estado sin embarques deja de dispararse; el `aria-label` sigue describiendo el estado.
- Fuera de alcance deliberado: chips de filtro, toggles de moneda, dropzones y disparadores de tooltip con layout muy custom (`CxpFiltrosChips`, `ProformasFiltrosChips`, `TarifasFilterChips`, `AgregarConceptoInline`, `EmbarqueBadgeAdmin`, `StepIndicator`, `PortSelect`).
- Cierre: `bunx tsgo --noEmit`, suites de arquitectura, revisión visual en navegador de Operaciones y Leads demo, entrada en `CHANGELOG.md` y bump de `APP_VERSION` a 13.656.0.
