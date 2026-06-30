# Fix: error "Vincula o crea una tarifa marítima" en cotizaciones CIF

## Causa raíz

En `13.142.0` se ocultaron los campos de tarifa marítima y condiciones comerciales en el Paso 1 cuando el incoterm es del grupo C/D (CIF, CFR, CIP, CPT, DAP, DDP, DAT), porque en esos casos el flete internacional ya lo paga el shipper en origen y Libre Carga solo cobra gastos locales destino.

Sin embargo, el validador del Paso 1 (`validateMaritimo` en `src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts`) todavía exige `tarifaId` para cualquier cotización marítima sin tomar en cuenta el incoterm. Resultado: el usuario llena el formulario CIF correctamente, no ve dónde vincular tarifa (está oculta) y al avanzar recibe el toast bloqueante.

## Cambio

Archivo único: `src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts`

En `validateMaritimo`, antes de exigir `tarifaId`, consultar `esIncotermSinFleteVenta(v.incoterm, v.modo)` desde `@/features/cotizacion/utils/incotermRules`. Si devuelve `true`, retornar `null` (sin error y sin registrar bloqueo en bitácora, porque no es un bloqueo real).

Comportamiento resultante:
- Marítimo + FOB/EXW/FCA → sigue exigiendo tarifa vinculada (igual que hoy).
- Marítimo + CIF/CFR/CIP/CPT/DAP/DDP/DAT → avanza sin tarifa, consistente con la UI que ya oculta el campo.
- Terrestre / Aéreo → sin cambios.

## Validación

- Tests unitarios nuevos en `src/features/cotizacion/hooks/wizard/__tests__/handlePaso1Crm.test.ts` (o el existente si lo hay) cubriendo: CIF marítimo sin tarifa → `null`; FOB marítimo sin tarifa → mensaje de error; CIF terrestre → sin cambios.
- Bump de versión a `13.142.1` + entrada en `CHANGELOG.md`.

## Fuera de alcance

No se toca la UI del wizard ni `usePaso1SectionStatus` (ya están correctos). No se cambia el comportamiento para FOB.
