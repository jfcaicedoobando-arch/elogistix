# Plan: Corregir ReferenceError `SIN_CLIENTE is not defined` en ConvertirLeadDialog

## Problema
El diálogo de convertir lead en CRM falla en runtime con:
```
ReferenceError: SIN_CLIENTE is not defined
    at ConvertirLeadDialog (.../ConvertirLeadDialog.tsx:40)
```
Aunque `SelectorClienteExistente.tsx` exporta `export const SIN_CLIENTE = "sin_cliente"`, el import combinado `import SelectorClienteExistente, { SIN_CLIENTE } from "..."` no siempre se resuelve correctamente en el bundle de Vite/SWC, especialmente con HMR o default + named exports mixtos.

## Solución propuesta
1. Extraer `SIN_CLIENTE` a una constante pura en `src/features/crm/constants/crmConstants.ts` (o similar) para desacoplarla del componente React.
2. Actualizar `SelectorClienteExistente.tsx` para importar `SIN_CLIENTE` desde la nueva ubicación en lugar de definirlo localmente.
3. Actualizar `ConvertirLeadDialog.tsx` y `ConvertirLeadSheet.tsx` para importar `SIN_CLIENTE` desde la constante compartida, eliminando el import named del default export.
4. Verificar que no haya dependencias circulares entre `useClientesForSelect` → `SelectorClienteExistente` → otros módulos CRM.
5. Agregar una prueba de renderizado mínimo para `ConvertirLeadDialog` y `ConvertirLeadSheet` que confirme que no lanzan `ReferenceError` al montarse.
6. Actualizar `CHANGELOG.md` y `src/constants/appVersion.ts` al siguiente patch (`13.763.1`).

## Criterios de aceptación
- [ ] El diálogo y el sheet de convertir lead renderizan sin error en la ruta `/crm/leads/:id`.
- [ ] La selección "Sin cliente (ligar después)" sigue funcionando.
- [ ] No hay regresión en la lógica de ligar un cliente existente.
- [ ] El CI pasa lint y tests relevantes.
