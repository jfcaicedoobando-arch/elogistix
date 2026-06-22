## Objetivo

Modernizar el modal de captura de factura de proveedor para que se sienta más ágil y profesional, eliminando las flechitas (spinners) molestas en los campos numéricos y reorganizando la jerarquía visual. No tocamos la lógica de IVA: sigue siendo captura manual.

## Cambios visibles para ti

1. **Header sticky con Total en vivo**
   - El total deja de estar "perdido" al final del bloque Importes. Aparece grande en la parte superior del modal, junto al título, y se queda visible al hacer scroll.
   - Analogía: como el subtotal del carrito en Amazon que te sigue mientras navegas.

2. **Inputs numéricos sin flechitas**
   - Subtotal, IVA, Retenciones, Días crédito y Tipo de cambio usarán el componente `NumericInput` que ya existe en el proyecto (`src/components/shared/NumericInput.tsx`).
   - Beneficios: sin spinners, sin cambio accidental por scroll del mouse, auto-selección al hacer foco (escribes y se reemplaza el `0`), alineación a la derecha con tipografía tabular.

3. **Reorganización de secciones**
   - Se agrupa Moneda + Tipo de cambio dentro de la misma sección que Importes (van de la mano conceptualmente).
   - Fechas y crédito en una sola fila más compacta.
   - La sección de Categorización + Notas se mueve al final dentro de un bloque colapsable "Detalles adicionales" (cerrado por defecto) para reducir ruido.

4. **Jerarquía visual mejorada**
   - Títulos de sección con icono pequeño (lucide-react) para escaneo rápido.
   - Separadores sutiles entre secciones en lugar de sólo whitespace.
   - Campos obligatorios marcados con asterisco rojo consistente.
   - Errores inline con icono `AlertCircle` en vez de sólo texto rojo.

5. **Footer con resumen de desglose**
   - Junto a los botones Cancelar/Guardar, una mini-tabla pegada arriba muestra: Subtotal · IVA · Ret · **Total**, todo con `tabular-nums` para que los números alineen perfectamente.

## Fuera de alcance

- Auto-cálculo de IVA (tú confirmaste: sin auto-IVA).
- Cambios al flujo de carga CFDI (`CargaCfdiSection`).
- Cambios a `VincularEmbarqueSection` (ya se rediseñó en la versión anterior).
- Cambios a backend, validaciones de negocio, o estructura de `useNuevaFacturaProveedorForm`.

## Detalles técnicos

**Archivos a editar:**
- `src/features/cxp/components/FacturaProveedorFormFields.tsx` — reemplazar `<Input type="number">` por `NumericInput`, reorganizar secciones, agregar iconos a títulos.
- `src/features/cxp/components/DialogNuevaFacturaProveedor.tsx` — header sticky con total, footer con desglose, hacer la sección "Detalles adicionales" colapsable con `<Collapsible>` de shadcn.
- `src/features/cxp/components/facturaFormPrimitives.tsx` — `FormSection` acepta `icon` opcional y prop `divider` para separador.

**Archivos a crear:**
- Ninguno. Reutilizamos `NumericInput`, `Collapsible`, `Separator` ya existentes.

**Consideración con `NumericInput`:**
- Hoy los importes en `FacturaFormValues` se almacenan como `string` (subtotal, iva, retenciones, tc). `NumericInput` trabaja con `number`. Adaptación: wrapper local en el componente que convierte `string ↔ number` sin tocar el hook ni los helpers (`buildPayload`, `calcularTotal` ya hacen `Number(values.subtotal)`).
- Para `diasCredito` ya es `number`, encaja directo.

**Versión y changelog:**
- Bump `APP_VERSION` a `13.99.3` en `src/constants/appVersion.ts`.
- Agregar entrada `## [13.99.3] - 2026-06-22` en `CHANGELOG.md` raíz con: "Rediseño del modal de captura de factura de proveedor: inputs numéricos sin spinners, total sticky, mejor jerarquía visual y detalles colapsables."

**Sin tests nuevos:** el cambio es puramente presentacional; no se altera lógica ni helpers. Los tests existentes de `useNuevaFacturaProveedorForm` siguen aplicando.

**Power of 10:**
- `FacturaProveedorFormFields.tsx` se mantiene <200 líneas (hoy 144).
- `DialogNuevaFacturaProveedor.tsx` se mantiene <200 líneas (hoy ~90).
