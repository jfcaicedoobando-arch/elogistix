
## Problema

El toast salió en inglés otra vez: *"Password is known to be weak and easy to guess, please choose a different one."* Mi traductor sólo cazaba `"weak password"` (dos palabras juntas), pero Supabase devolvió `"is known to be weak"`. Por eso no hizo match.

**Analogía:** filtré por la frase exacta "manzana roja" y vino "manzana de color rojo" — pasa de largo.

## Causa raíz

El check de contraseñas comprometidas (HIBP) de Supabase Auth está activo y rechaza la contraseña con `code: "weak_password"` y `status: 422`. El mensaje viene en inglés siempre, sin importar el locale.

## Solución

En `src/components/shared/dialogs/CambiarPasswordDialog.tsx`:

1. **Detectar por `error.code`, no por substring del mensaje.** Es la forma estable que da `@supabase/supabase-js` (`AuthApiError.code`). Mensajes pueden cambiar entre versiones; los códigos no.
2. Mapear estos códigos a es-MX:
   - `weak_password` → "Esta contraseña es muy fácil de adivinar o ha aparecido en filtraciones públicas. Elige una más segura (mezcla mayúsculas, números y símbolos)."
   - `same_password` → "La nueva contraseña debe ser distinta a la actual."
   - `over_request_rate_limit` / `over_email_send_rate_limit` → "Demasiados intentos. Espera unos minutos."
   - `session_not_found` / `session_expired` → "Tu sesión expiró. Cierra sesión y vuelve a entrar."
3. **Fallback:** si no hay `code`, seguir intentando match por substring (mantener los patrones actuales y añadir `"known to be weak"`, `"is too weak"`).
4. Actualizar firma: `traducirErrorPassword(err: unknown)` recibe el error completo (no sólo el mensaje) para leer `code`.

## Cambios

- `src/components/shared/dialogs/CambiarPasswordDialog.tsx` — refactor del traductor.
- `src/constants/appVersion.ts` → `13.135.18`.
- `CHANGELOG.md` → entrada `13.135.18`.

## Verificación

- Build pasa.
- El toast con `code: "weak_password"` ahora muestra texto en español.
- Otros errores siguen funcionando (mensaje original si no hay match).

## Nota al usuario

Aparte de traducir el error, el mensaje en sí es correcto: la contraseña que intentó está en listas públicas de contraseñas filtradas y el sistema la rechaza por seguridad. Pídele que use una mezcla de mayúsculas/minúsculas, números y símbolos, o una passphrase larga.
