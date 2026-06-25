## Plan: Revertir umbral y añadir tests para el código nuevo

### Regla a guardar en memoria
Crear `mem://principles/coverage-threshold`:
- **Nunca** bajar los umbrales de coverage en `vitest.config.ts` como "fix" cuando CI falla por cobertura.
- La solución correcta es **escribir tests** para el código nuevo que causó la caída.
- Umbral mínimo actual: **lines/statements 38%, functions 52%, branches 72%**.
- Añadir referencia en `mem://index.md` (Core).

### Revertir el cambio incorrecto
- `vitest.config.ts`: subir `lines` y `statements` de **37 → 38** (estado previo).
- Quitar el comentario justificativo que añadí.

### Añadir tests para cubrir el código reciente que causó la caída
Los componentes que metieron líneas sin tests:

1. **`src/lib/auth/changePassword.ts`** (lógica pura, fácil de cubrir)
   - Test de `traducirErrorPassword` para cada código de error mapeado (same_password, weak_password, etc.) → cubre muchas branches.
   - Test de `changePassword` con mock de `supabase.auth.updateUser` (éxito y error).

2. **`src/components/shared/dialogs/CambiarPasswordDialog.tsx`**
   - Render del diálogo abierto.
   - Validación: contraseñas no coinciden → muestra error.
   - Submit exitoso → llama `changePassword` y cierra.
   - Submit con error → muestra toast traducido.

3. **`src/components/layout/OrgBadge.tsx`**
   - Render con organización presente.
   - Render sin organización (no rompe).

4. **`src/features/configuracion/components/OrgInfoCard.tsx`**
   - Render con datos de organización.
   - Estado de carga.

5. **`src/features/usuarios/.../InvitarAgentePortalDialog.tsx`** (si la complejidad lo permite, sino dividir)
   - Render de tabs (invitar por email vs asignar contraseña).
   - Validación de contraseña en el tab de asignar.
   - Submit en cada tab llama al edge function con el payload correcto.

### Verificación
- `bun run test` pasa.
- `bun run test -- --coverage` reporta lines/statements ≥ 38%.
- Bump a `v13.135.69` + entrada en `CHANGELOG.md` describiendo: revert del umbral + tests añadidos.

### Notas técnicas
- Usar `@testing-library/react` con `userEvent` para los diálogos.
- Mockear `@/integrations/supabase/client` siguiendo el patrón thenable ya establecido (ver `mem://technical/testing-mock-patterns`).
- Respetar `afterEach` global de cleanup (`mem://technical/testing-cleanup-protocol`).
