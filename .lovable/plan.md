## Qué está pasando

Estás viendo dos síntomas de un mismo bug:

1. **El toast desaparece antes de que puedas hacerle clic.** Nuestro `Toaster` global tiene `duration={4000}`, así que el aviso de `toast.warning(...)` se auto-cierra en 4 s. Para un warning que reporta *"la factura se guardó pero un paso posterior falló"* eso es demasiado corto: es información crítica que el usuario necesita leer completa y poder cerrar manualmente. Además el mensaje viene sin botón de acción, así que no hay nada donde "hacer clic" (sólo la X del corner, que no alcanzas a apretar).

2. **La causa real del error**: `crearAjustesFacturaProveedor` inserta en `conceptos_costo` un renglón con `monto = monto_facturado − monto_devengado`. Cuando el proveedor te cobra **menos** de lo devengado (descuento), ese `delta` es **negativo**. Pero la tabla tiene un CHECK `conceptos_costo_monto_nonneg (monto >= 0)` que prohíbe montos negativos, así que el INSERT truena con el error que viste.

    En otras palabras: el modelo *dice* "signo negativo = descuento del proveedor → utilidad sube", pero la base de datos nunca aceptó ese contrato. Todo ajuste a la baja está roto hoy.

    Analogía: es como si tu cuaderno de gastos tuviera una regla "sólo se aceptan cantidades positivas" y quisieras anotar una devolución. No puedes; tienes que cambiar la regla o inventar una columna "tipo: cargo/devolución".

## Qué voy a cambiar

### 1. Permitir ajustes negativos en `conceptos_costo` (backend)

Migración que reemplaza el CHECK global por uno condicional:

```sql
-- Los renglones normales siguen exigiendo monto >= 0.
-- Sólo los ajustes de factura de proveedor pueden ser negativos
-- (representan descuentos o notas de crédito sobre lo devengado).
ALTER TABLE public.conceptos_costo
  DROP CONSTRAINT IF EXISTS conceptos_costo_monto_nonneg;

ALTER TABLE public.conceptos_costo
  ADD CONSTRAINT conceptos_costo_monto_signo CHECK (
    monto >= 0
    OR origen = 'ajuste_factura_proveedor'
  );
```

Verifico con `SELECT SUM(monto) …` en un embarque de prueba que la utilidad ya se calcula sumando (los negativos restan correctamente porque `SUM` respeta el signo).

### 2. Mejorar el toast de error

En `useNuevaFacturaProveedorForm.sideEffects.ts` los dos `toast.warning(...)` de "factura guardada pero X falló" pasan a:

- `duration: Infinity` (no se auto-cierra).
- Título breve + `description` con el detalle técnico.
- `action` con botón "Copiar detalle" para que el usuario nos lo comparta si insiste.

Así el usuario alcanza a leer, cerrar con la X, o copiar el mensaje.

### 3. Test de regresión

Test unitario en `crearAjustesFacturaProveedor.test.ts` que valide un caso con `delta < 0` (proveedor factura menos) devuelve `ajustesCreados: 1` sin lanzar.

### 4. Versionado

- `APP_VERSION` → `13.307.8`.
- Entrada en `CHANGELOG.md` explicando el bug con analogía.

## Detalles técnicos

- Archivos modificados:
  - `supabase/migrations/<nuevo>.sql` — reemplaza el CHECK.
  - `src/features/cxp/hooks/useNuevaFacturaProveedorForm.sideEffects.ts` — dos toasts persistentes.
  - `src/features/cxp/services/__tests__/crearAjustesFacturaProveedor.test.ts` — caso delta negativo (mock devuelve `{ error: null }`).
  - `src/constants/appVersion.ts` + `CHANGELOG.md`.
- No toco el trigger de reversión (`tg_reverse_ajustes_factura_proveedor`) ni la UI de detalle CxP: siguen funcionando igual porque sólo hacen `SUM/UPDATE deleted_at`.
- No cambio la severidad global del `Toaster` (otros toasts siguen con 4 s, que es lo correcto para éxito/info).
