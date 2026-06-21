# Plan: Layout proforma + link factura roto

## Diagnóstico

**Bug del link a factura asociada** — Verificado con Playwright en `/facturacion/5854b3d0-...`. La petición a PostgREST responde **HTTP 300 Multiple Choices** (no 404), lo que hace que el hook devuelva `null` y la página muestre "Factura no encontrada o sin acceso".

Causa raíz: en `src/features/facturacion/services/detail.ts` el select usa `proformas:proformas(numero)` para incrustar la proforma. Como existen relaciones FK en ambos sentidos (`facturas.proforma_id → proformas` y `proformas.factura_id → facturas`), PostgREST no sabe cuál usar y devuelve 300.

Analogía: es como pedirle a alguien "tráeme el libro" cuando hay dos libros del mismo nombre — necesita que le digas cuál. Aquí le especificamos la FK exacta.

**Layout actual** (captura tomada):
- El email del operador (`juanluis.martinez@elogistixshipping...`) se desborda y choca con "Días crédito"
- "Volver" queda suelto arriba; el header no destaca el total
- "Factura asociada" muestra poco contexto (sólo número y estado)
- Mucho espacio vacío a la derecha en pantallas anchas

## Cambios

### 1. Fix link factura (`src/features/facturacion/services/detail.ts`)
- Cambiar embed a `"proformas:proformas!facturas_proforma_id_fkey(numero)"` para desambiguar la FK.

### 2. Mejorar layout `src/features/proformas/routes/ProformaDetalle.tsx`
- **Header unificado**: mover "Volver" a la misma fila que el título (chip secundario) y agregar el **total grande a la derecha** (estilo `FacturaDetalle`).
- **Datos generales**: usar `nombreDesdeEmail(proforma.operador)` para evitar overflow; añadir `title` con el email completo; convertir el grid a `md:grid-cols-4` con `min-w-0` y `truncate` para que ningún campo invada al vecino.
- **Acciones secundarias**: agrupar "Descargar PDF" / "Ver embarque" en una barra de acciones bajo el header (no apiñadas al lado del título).
- **Factura asociada (rediseño)**:
  - Título de card: "Factura asociada {numero}" con `Badge` de estado.
  - Grid 2-col: monto, fecha de emisión, UUID fiscal (si existe), folio.
  - Botón primario "Ver factura" (Link) + botones de PDF/XML.
  - Si no hay factura pero `estado_proforma==='facturada'`, mostrar nota informativa.
- **Reducir ancho contenedor** `max-w-5xl` y mantener spacing `space-y-4` para que se sienta menos vacío.

### 3. Sin cambios de negocio
- No se toca `useProformaDetalle`, totales, conceptos, ni RLS.
- No se cambian rutas.

## Verificación

Con Playwright, autenticado:
1. Navegar a `/proformas/e553385d-74c6-4611-942a-4bb2bc54a4a2` → screenshot del nuevo layout (sin overflow del operador, header con total, card de factura completa).
2. Hacer click en "Ver factura" → debe abrir `/facturacion/5854b3d0-...` y renderizar el detalle (no el mensaje de "no encontrada").
3. Capturar respuesta de la query `facturas?select=...` → status 200 (no 300).

## Changelog / versión

- `src/constants/appVersion.ts` → `13.90.4`
- `CHANGELOG.md` → entrada `[13.90.4]`:
  - Fix: link a factura asociada desde proforma (embed FK explícita)
  - UI: rediseño del detalle de proforma (header con total, datos generales sin overflow, card de factura asociada con más contexto)

## Detalles técnicos

```ts
// detail.ts
"proformas:proformas!facturas_proforma_id_fkey(numero)"
```

```tsx
// Operador truncate
<p className="truncate" title={proforma.operador ?? ''}>
  {proforma.operador ? nombreDesdeEmail(proforma.operador) : '—'}
</p>
```

Archivos editados: 3 (`detail.ts`, `ProformaDetalle.tsx`, `appVersion.ts`) + `CHANGELOG.md`.
