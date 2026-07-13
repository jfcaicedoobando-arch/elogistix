# Plan — Ocultar tarifa marítima vinculada en LCL

## Objetivo
Cuando el tipo de embarque marítimo sea **LCL**, el wizard de cotización no debe mostrar el panel de "Tarifa marítima vinculada" ni el bloque de sugerencias de tarifas. LCL usa captura manual (tarifa W/M, mínimo, consolidador) que ya se implementó en v13.299.0.

## Cambios

1. **`PasoDatosGenerales.tsx`** (u orquestador equivalente del paso 1)
   - Condicionar el render de `<TarifaVinculadaPanel>` y `<SugerenciasTarifaInline>` a `esMaritimo && tipoEmbarque !== "LCL"`.

2. **`Paso1ProgressSidebar.tsx`**
   - Ocultar el item "Tarifa" del sidebar de progreso cuando `tipoEmbarque === "LCL"`.

3. **`usePaso1SectionStatus.ts`**
   - Verificar que la validación `tarifa` ya considera LCL como no requerido (según v13.299.0). Si no, marcar `tarifa` como completo/omitido para LCL para que no bloquee "Siguiente".

4. **Limpieza de estado al cambiar a LCL**
   - Si el usuario cambia `tipoEmbarque` de FCL → LCL con una tarifa ya vinculada, limpiar `tarifaId` y `tarifaOverride` para evitar estado huérfano (efecto en `PasoDatosGenerales` o en el onChange del selector de tipo de embarque).

5. **Versionado**
   - Bump `APP_VERSION` a `13.299.1` + entrada en `CHANGELOG.md`.

## Fuera de alcance
- Cambios en FCL (mantiene tarifa obligatoria).
- Cambios en aéreo/terrestre.
- Migración de cotizaciones LCL existentes con `tarifa_id` (se mantienen tal cual, solo dejan de mostrarse los controles de tarifa en nuevas ediciones LCL).

## Notas
Si ya existe una cotización LCL con tarifa vinculada, al abrirla los datos heredados (recargos, días libres) siguen persistidos como conceptos; simplemente no se muestra el panel de tarifa. Analogía: en LCL ya no le pedimos al usuario que "escoja un menú del día"; le dejamos armar el plato a la carta.
