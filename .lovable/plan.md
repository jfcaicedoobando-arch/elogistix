# Plan · Modal Generar Proforma sin `diasCredito` ni `operador` en UI

## Diagnóstico (verificado)

Hoy el modal `DialogGenerarProforma` muestra dos campos que ya existen como **fuente única de verdad** en otras tablas:

- **Días de crédito** — input editable (`<Input type="number">`) en `ProformaFooterFields` (línea 120-128 de `PasoSeleccionConceptos.parts.tsx`). El default se lee de `useDiasCreditoCliente(embarque.cliente_id)` en el controller (línea 44 de `useDialogGenerarProformaController.ts`), pero luego el usuario puede sobrescribirlo. **La SoT es `clientes.dias_credito`.**
- **Ejecutivo de Operaciones** — display readonly en `ProformaFooterFields` (línea 134-138). Se pasa desde `embarque.operador`. **La SoT es `embarques.operador`.**

Ambos también aparecen en `PasoConfirmacionProforma.tsx` (líneas 62 y 67) como parte del resumen.

Al aceptar edición del campo de crédito, la proforma puede quedar con condiciones distintas a las del cliente sin que nadie se entere → riesgo de descuadre entre CxC del cliente y política crediticia.

## Cambios

**1. UI — quitar ambos campos del modal**

- `src/features/embarques/components/proforma/PasoSeleccionConceptos.parts.tsx`
  - Reducir `ProformaFooterFields` para que renderice **solo el `<Textarea>` de notas**. Eliminar el grid con "Días de crédito" y "Ejecutivo de Operaciones", los props `diasCredito`, `operadorEmbarque` y `onDiasCreditoChange`.
- `src/features/embarques/components/proforma/PasoSeleccionConceptos.tsx`
  - Quitar props `diasCredito`, `operadorEmbarque`, `onDiasCreditoChange` de la interfaz y del render de `ProformaFooterFields`.
- `src/features/embarques/components/proforma/PasoConfirmacionProforma.tsx`
  - Quitar del resumen las líneas "Operador" y "Días de crédito" y sus props. El resumen queda con conceptos, totales y notas.
- `src/features/embarques/components/DialogGenerarProforma.tsx`
  - No pasar ya `diasCredito`, `operadorEmbarque`, `onDiasCreditoChange` a los dos pasos.

**2. Controller — dejar `diasCredito` y operador como valores derivados internos, no como estado editable**

- `src/features/embarques/hooks/useDialogGenerarProformaController.ts`
  - Eliminar `useState` de `diasCredito` y `setDiasCredito`, y el `useEffect` que lo sincroniza (líneas 51, 94-97).
  - Al construir el payload de submit, resolver `diasCredito` **en el momento** desde `useDiasCreditoCliente(embarque.cliente_id)` (ya está cargado) y `operador` desde `embarque.operador`. Nunca se exponen al UI ni se permiten sobrescribir.

**3. Submit — sin cambios de contrato hacia la BD**

- `src/features/embarques/services/submitProformaDialog.ts` sigue recibiendo `diasCredito` como string y `embarque.operador`. Cambia solo la fuente en el controller: la string proviene siempre de `clientes.dias_credito` (o `""` si null), no de un input editable. La lógica de parseo (`diasCredito.trim() === "" ? null : Number(...)`) se conserva.

**4. Tests**

- `src/features/embarques/hooks/__tests__/useProformaDialog.test.tsx` y `src/features/embarques/services/__tests__/submitProformaDialog.test.ts`: actualizar mocks/aserciones que aún referencien `setDiasCredito` u `onDiasCreditoChange`. Añadir un test que verifique que aunque `useDiasCreditoCliente` regrese `30`, el submit siempre manda `30` (no hay manera de que el usuario mande otro valor).

**5. Changelog + bump**

- `CHANGELOG.md` bajo `## [13.303.80] - 2026-07-21` con nota corta explicando que se retiran los campos del modal y quedan como SoT.
- `src/constants/appVersion.ts` → `13.303.80`.

## Fuera de alcance

- No se modifica la tabla `proformas` ni sus columnas `dias_credito` / `operador` — se siguen persistiendo, solo cambia dónde se leen.
- No se toca la lógica de cálculo de vencimiento ni las políticas de crédito.
- Si en el futuro se quiere permitir override justificado (con bitácora), sería un feature aparte con confirmación y motivo.

## Analogía para ti

Es como el nombre del cliente en una factura: no lo tecleas cada vez, lo hereda el sistema. Igual aquí: los días de crédito los pone el expediente del cliente y el ejecutivo lo pone el expediente del embarque. Si están mal, se corrigen en su lugar (una sola vez), no en cada proforma.
