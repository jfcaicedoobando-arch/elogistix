## Diagnóstico

Los 2 únicos issues abiertos en Sentry (últimos 7 días) son **validaciones de negocio esperadas**, no bugs:

| Issue | Mensaje | pg_code |
|---|---|---|
| `JAVASCRIPT-REACT-2W` | `LC_TRANSICION_INVALIDA: no se permite pasar de En Tránsito a Arribo` | P0001 |
| `JAVASCRIPT-REACT-2V` | `LC_TRANSICION_INVALIDA: no se permite pasar de Borrador a Confirmado` | P0001 |

Ambos vienen de guardas de máquina de estados en BD (`RAISE EXCEPTION 'LC_TRANSICION_INVALIDA…'`). La UI ya los captura y muestra el toast **"Transición de estado no permitida"** con instrucción de refrescar la página. Son ruido — mismo patrón que la regla que ya tenemos para `23514` (check constraints) en `reportCaughtError.ts`.

Analogía: es como si tu app te avisara que "no puedes retirar dinero sin saldo" y a la vez enviara una alarma a soporte. El usuario ya vio el mensaje bonito; soporte no necesita enterarse.

## Cambio

### 1. `src/lib/observability/reportCaughtError.ts`
Extender el filtro `EXPECTED_PG_CODES` para descartar también errores P0001 cuyo `message` empiece con el prefijo `LC_` (convención del proyecto para errores de dominio lanzados desde BD).

```ts
// Antes: Set<string> con solo "23514"
// Después: función isExpectedBusinessError(classified) que:
//   - descarta 23514 (check constraint)
//   - descarta P0001 cuando message.startsWith("LC_")
```

Otros P0001 (raise genéricos sin prefijo `LC_`) siguen llegando a Sentry — no queremos ocultarlos por accidente.

### 2. `src/lib/observability/__tests__/reportCaughtError.test.ts`
Añadir 2 tests:
- descarta P0001 con mensaje `LC_TRANSICION_INVALIDA…`
- **NO** descarta P0001 con mensaje sin prefijo `LC_` (regresión)

### 3. Cerrar issues en Sentry
Marcar `JAVASCRIPT-REACT-2W` y `JAVASCRIPT-REACT-2V` como `resolved` vía `update_issue`, referenciando la versión del fix (por memoria `mem://preferences/sentry-resolve`).

### 4. Housekeeping
- Bump `APP_VERSION` → `13.302.7`
- Entrada en `CHANGELOG.md` referenciando ambos issueIds

## Fuera de alcance
No se toca la lógica de transiciones ni los toasts existentes — el usuario ya recibe el mensaje correcto. Solo se silencia el reporte duplicado a Sentry.
