# Dividir SeccionRutaCotizacion.tsx (≤200 líneas, regla Power of 10)

## Problema
El test `audit-report` / `architecture-baseline` falla en CI:
```
src/features/cotizacion/components/SeccionRutaCotizacion.tsx (290 líneas)
```
Excede el límite de 200 líneas para archivos productivos. El archivo creció con los cambios de "tarifa vinculada" introducidos en versiones anteriores de esta sesión.

## Solución
Extraer los sub-componentes y helpers a archivos nuevos en una carpeta dedicada `seccionRuta/`, dejando `SeccionRutaCotizacion.tsx` como orquestador < 100 líneas. No cambia la UI ni el comportamiento.

## Cambios

**1. Crear `src/features/cotizacion/components/seccionRuta/overrideHelpers.ts`**
- `OPTS`, tipo `Ctx`, `marcarOverride`, tipo `TarifaCtx`.

**2. Crear `src/features/cotizacion/components/seccionRuta/OrigenDestinoBlock.tsx`**
- Mueve `OrigenDestinoBlock` (líneas 30-67).

**3. Crear `src/features/cotizacion/components/seccionRuta/TarifaFields.tsx`**
- Mueve `TransitoField`, `FclLclFields`, `CartaGarantiaSlot` (líneas 76-160).

**4. Crear `src/features/cotizacion/components/seccionRuta/SeguroBlock.tsx`**
- Mueve `SeguroBlock` (líneas 162-183).

**5. Crear `src/features/cotizacion/components/seccionRuta/BannerOverride.tsx`**
- Mueve `BannerOverride` (líneas 185-203).

**6. Reescribir `SeccionRutaCotizacion.tsx`**
- Importa los nuevos módulos y conserva solo el componente principal (~80 líneas).

**7. Metadata**
- `APP_VERSION` → `13.26.3`
- `CHANGELOG.md`: entrada `[13.26.3]` — "refactor(cotizaciones/wizard): SeccionRutaCotizacion dividido en sub-componentes para cumplir Power of 10 (≤200 líneas)."

## Fuera de alcance
- Cambios funcionales (UI/lógica) — refactor puro.
