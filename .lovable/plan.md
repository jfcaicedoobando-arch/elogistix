

## Plan: Refactoring — IVA hardcodeado, formatDate con date-fns, y asset duplicado

### 1. Reemplazar `* 1.16` por funciones de `financialUtils.ts` en `useCotizacionWizardForm.ts`

Hay 3 líneas con `* 1.16` hardcodeado que deben usar `calcularTotalConIVA`:

- **Línea 283**: `sub * 1.16` → `calcularTotalConIVA(sub)` y `sub * (aplica_iva ? 1.16 : 1)` → `aplica_iva ? calcularTotalConIVA(sub) : sub`
- **Línea 435**: `c.cantidad * c.precio_venta * (tieneIva ? 1.16 : 1)` → `tieneIva ? calcularTotalConIVA(c.cantidad * c.precio_venta) : c.cantidad * c.precio_venta`
- **Línea 443**: `c.cantidad * c.precio_venta * 1.16` → `calcularTotalConIVA(c.cantidad * c.precio_venta)`

`calcularTotalConIVA` ya está importado en línea 9.

### 2. Reemplazar `formatDate` manual por `date-fns` en `src/lib/helpers.ts`

Cambiar la implementación de string-splitting por:
```typescript
import { format, parseISO } from "date-fns";

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
};
```

Misma firma, misma salida `dd/MM/yyyy`, pero robusto ante formatos edge-case. `date-fns` ya es dependencia del proyecto. Los 13 archivos consumidores no requieren cambios.

### 3. Eliminar asset duplicado `public/elogistix-logo.jpg`

Solo se usa `src/assets/elogistix-logo.jpg` (en `AppSidebar.tsx` y `Login.tsx`). El archivo en `public/` no se referencia en ningún componente.

### Archivos modificados
- `src/hooks/useCotizacionWizardForm.ts` — 3 líneas
- `src/lib/helpers.ts` — reescribir `formatDate`
- Eliminar `public/elogistix-logo.jpg`

