# Agregar "Origen" al alta express de lead

## Contexto
El modal inicial de alta de lead (`QuickCreateLeadDialog`, alta express) hoy captura sólo Empresa y "Correo o teléfono", y guarda el origen fijo en "Prospección" sin preguntarlo. El modal completo "Nuevo lead" ya tiene el campo **Origen** con las 3 opciones. El equipo quiere elegir el origen desde el modal inicial.

## Cambios

1. **`src/features/crm/components/quickCreate/QuickCreateLeadDialog.tsx`**
   - Agregar un `Select` "Origen" con las 3 opciones del catálogo (`LEAD_FUENTES`: Prospección, Finkargo, Referido), default **Prospección**.
   - Estado local nuevo `fuente`; se limpia en el reset de cierre (transición abierto → cerrado) junto con empresa/contacto, volviendo a Prospección.
   - Al confirmar, pasar el origen elegido a `leadQuickCreateInput`.
   - Incluir `fuente` en el borrador de "Más campos →" (`LeadQuickDraft`) para no perder lo elegido si el usuario salta al formulario completo.

2. **`src/features/crm/domain/leads/quickCreateInput.ts`**
   - `leadQuickCreateInput` acepta la fuente como parámetro (default "Prospección") en lugar de fijarla siempre.

3. **`src/features/crm/components/NuevoLeadDialog.tsx` / `LeadQuickDraft`**
   - El borrador express (`draftInicial`) suma `fuente` opcional; si viene, se usa como valor inicial del campo Origen en el formulario completo.

4. **Pruebas focalizadas (no ejecutar en Lovable; corren en GitHub Actions)**
   - Ajustar/crear tests del quick-create: default Prospección, selección de Finkargo/Referido persiste en el input, y traspaso del origen a "Más campos →".

5. **Entrega**
   - Bump patch en `src/constants/appVersion.ts` (siguiente a 13.823.225) y entrada en `CHANGELOG.md`.
   - `bun run db:release-manifest:update` si el conteo de migraciones cambió (no se esperan migraciones nuevas).
   - Validación local sólo estática focalizada: typecheck + ESLint de archivos tocados (y build si es razonable). **No** Vitest/CI/RLS/E2E locales; eso queda en GitHub Actions.
   - Sin migraciones, sin cambios de datos, sin tocar el modal completo ni el catálogo. No publicar.

## Notas técnicas
- Reutiliza `LEAD_FUENTES` (`src/features/crm/domain/leads/constants.ts`) — fuente única del catálogo.
- Sin nuevas columnas: `crm_leads.fuente` ya existe.
- Componente ≤200 líneas: el select se suma al bloque existente; si el archivo supera el límite, extraer el campo a un subcomponente mínimo.
