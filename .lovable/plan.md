# Borrar "Parámetros de Facturación" (tasa IVA global)

## Analogía

Es como quitar el letrero de "IVA general: 16%" del menú del restaurante ahora que cada platillo trae su propio IVA impreso en el menú (el catálogo de productos). El default queda hardcodeado a 16% porque en México lleva 30 años sin moverse — si algún día cambia, es un cambio de constante, no de UI.

## Alcance

- **UI**: eliminar la tarjeta "Parámetros de Facturación" de `Configuración → Facturación`.
- **Hook `useTasaIVA()`**: se conserva como **función pura** que retorna la constante `TASA_IVA` (0.16), sin leer de la BD. Todos los ~15 consumidores siguen funcionando sin cambios en su firma.
- **Estado de Configuración**: quitar el campo `tasaIva` de `ConfigState` y del handler `handleSave`.
- **BD**: dejar la fila `configuracion.categoria='facturacion', clave='tasa_iva'` como legacy (no se borra por seguridad; sin lectores). Nota en changelog.

## Cambios

### 1. `src/features/configuracion/components/TabFacturacion.tsx`
Quitar la `Card` de "Parámetros de Facturación" y sus props (`tasaIva`, `setTasaIva`). El componente queda como wrapper de `FacturapiCredencialesCard` + `CatalogoClavesSATCard`.

### 2. `src/features/configuracion/hooks/useConfiguracionState.ts`
- Quitar `tasaIva` de `ConfigState`.
- Quitar la línea `tasaIva: String(...)` de `buildStateFromConfig`.
- Quitar la entrada `{ categoria: 'facturacion', clave: 'tasa_iva', ... }` de `handleSave`.

### 3. `src/features/catalogos/hooks/useTasaIVA.ts`
Reemplazar por versión pura:
```ts
import { TASA_IVA } from "@/lib/financial/financialUtils";
export function useTasaIVA(): number {
  return TASA_IVA; // 0.16 — IVA general de México
}
```
Con esto los ~15 consumidores (cotización, proformas, PDFs) siguen usando `useTasaIVA()` sin ningún cambio. Si algún día cambia la tasa, se toca una sola constante.

### 4. Llamador de `TabFacturacion` en la página de configuración
Buscar dónde se renderiza (probablemente `RouteConfiguracion.tsx` o similar) y quitar las props que ya no existen.

### 5. Tests
- Actualizar `useTasaIVA.test.tsx` para verificar que retorna 0.16 constante.
- Revisar tests de `useConfiguracionState` si tocan `tasaIva`.

### 6. Version + changelog
- Bump `APP_VERSION` a **13.170.0**.
- Entrada en `CHANGELOG.md` explicando la eliminación.

## Riesgos

- **Bajo**. La tasa siempre ha estado en 16 en producción. Si algún tenant llegó a poner otro valor (ej. 8% frontera), lo perderán y usarán 16. Podemos verificar antes de aplicar con un `SELECT` a la tabla `configuracion` — si algún tenant tiene un valor distinto a 16, revisamos.
- La fila en `configuracion` queda huérfana pero no rompe nada; se limpiará en migración de higiene futura.

## Fuera de alcance

- No se toca la BD ni se borran filas.
- No se cambia el catálogo de productos ni la lógica de IVA por concepto.
