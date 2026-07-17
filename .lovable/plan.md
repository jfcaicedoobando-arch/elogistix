## Plan: limpiar Sentry y silenciar validaciones SAT esperadas

### Contexto

De los 6 issues abiertos, **5 ya están corregidos en producción** (versiones ≤13.301.28, fixes desplegados en 13.301.30/35/16/27). El sexto (2T) es una validación de FacturApi/SAT — dato mal capturado, no bug — que se está reportando como error genérico.

### Acciones

**1. Cerrar issues ya resueltos en Sentry** (usar `update_issue` con `status: resolved` y comentario apuntando a la versión del fix):

- `JAVASCRIPT-REACT-2S` → fix 13.301.35
- `JAVASCRIPT-REACT-2R` → fix 13.301.30
- `JAVASCRIPT-REACT-2Q` → fix 13.301.27
- `JAVASCRIPT-REACT-2P` → fix 13.301.16
- `JAVASCRIPT-REACT-2N` → mejora UX 13.301.1 (comportamiento SAT esperado — no es bug de código)

**2. Filtrar validaciones esperadas de FacturApi para que no lleguen a Sentry (issue 2T)**

Actualmente `parseFacturapiError` marca ciertos errores como `transient` (reintentables), pero todos terminan reportándose vía `reportCaughtError` en el `onError` de la mutation `emitir-factura`/`cancelar-factura`.

Añadir una nueva clase de error: **`expected_business` = validación de datos que el usuario debe corregir**. Ejemplos:
- "El campo Nombre del receptor, debe pertenecer al nombre asociado al RFC…"
- "El RFC del receptor no está registrado ante el SAT"
- "El régimen fiscal no es válido para el RFC"

**Implementación:**

- En `src/features/facturacion/services/facturapiError.ts` (o donde vive `mapFacturapiError`): añadir flag `expected: boolean` con una whitelist regex de patrones de mensaje SAT/FacturApi conocidos como validaciones de negocio.
- En `useTimbrarFactura` y `useCancelarFactura` (hooks de mutation): en `onError`, si `error.expected === true`, mostrar toast con mensaje amable ("Verifica la razón social del cliente en Constancia Fiscal") y **NO** llamar a `reportCaughtError`.
- Extender el patrón que ya existe en `reportCaughtError.ts` con `EXPECTED_PG_CODES` (23514) — pero aplicado a errores de FacturApi en el call site del hook.

**3. Test guardrail**

Añadir `src/features/facturacion/services/__tests__/facturapiError.expected.test.ts` que valide:
- Mensaje "Nombre del receptor debe pertenecer al nombre asociado al RFC" → `expected: true`
- Mensaje genérico "Internal server error" → `expected: false`

**4. Changelog + versión**

Bump `APP_VERSION` a `13.301.59`, entrada en `CHANGELOG.md`:

```
## [13.301.59] - 2026-07-17
- Sentry: cerrados 5 issues ya corregidos (2S, 2R, 2Q, 2P, 2N).
- Facturación: validaciones SAT/FacturApi esperadas (razón social vs RFC,
  RFC no registrado, régimen fiscal inválido) ya no se reportan a Sentry —
  se muestran como toast accionable al usuario. Ref JAVASCRIPT-REACT-2T.
```

### Fuera de alcance

- No tocamos la lógica de timbrado ni de cancelación — solo la clasificación de errores.
- No modificamos `reportCaughtError` global; el filtro vive en el hook de facturación para no ocultar otros errores legítimos.
