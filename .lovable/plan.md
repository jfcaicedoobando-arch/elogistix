# Regla: cleanup obligatorio en useEffect con suscripciones / listeners / timers

## Auditoría del estado actual

Revisé todos los `useEffect` del proyecto que involucran efectos con cleanup necesario. **Todos ya devuelven la función de limpieza correcta**:

| Archivo | Efecto | Cleanup |
|---|---|---|
| `src/contexts/auth/useAuthSession.ts` | `supabase.auth.onAuthStateChange` | `subscription.unsubscribe()` ✓ |
| `src/contexts/auth/useAuthProfile.ts` | `setTimeout` defer | `clearTimeout(t)` ✓ |
| `src/contexts/auth/useLoginAudit.ts` | `setTimeout` registrar login | `clearTimeout(t)` ✓ |
| `src/hooks/use-mobile.tsx` | `mql.addEventListener("change")` | `removeEventListener` ✓ |
| `src/hooks/shared/useDebounce.ts` | `setTimeout` debounce | `clearTimeout` ✓ |
| `src/components/layout/Layout.tsx` | `window.addEventListener("resize")` | `removeEventListener` ✓ |
| `src/components/shared/GlobalSearch.tsx` | `keydown` listener + debounce | `removeEventListener` + `clearTimeout` ✓ |
| `src/components/cotizacion/CotizacionWizardLayout.tsx` | `setTimeout` autofocus | `clearTimeout` ✓ |

No hay fugas que corregir.

## Acción

Guardar la regla como **Core memory** del proyecto para que aplique automáticamente a todo código futuro:

> Every useEffect with Supabase channels / onAuthStateChange, addEventListener, setTimeout / setInterval MUST return a cleanup function (unsubscribe / removeEventListener / clearTimeout / clearInterval).

No requiere cambios de código ni bump de versión — es una guía de estilo permanente. El plan se reduce a confirmar la auditoría y registrar la regla.
