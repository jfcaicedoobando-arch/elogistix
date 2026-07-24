## Cierre C1 — bump de versión + CHANGELOG

Analogía: ya retocamos la placa de la puerta; ahora firmamos la bitácora y avanzamos el contador.

### Cambios
1. `src/constants/appVersion.ts`: `13.312.17` → `13.312.18`.
2. `CHANGELOG.md` (raíz): agregar entrada `## [13.312.18] - 2026-07-24` con bullets:
   - Corregido comentario de baseline en `eslint.config.js` (SONNER_LEGACY_ALLOWLIST): "84 archivos" → "82 archivos + 6 wrappers".
   - Verificado que el resto de la condición C1 del release ya estaba aplicado (ARCHITECTURE.md §1, banners OBSOLETO en `docs/architecture-map.md` y `docs/architecture.md`, números en `arquitectura-auditoria-3-status.md`, baseline en `migrations-hygiene.md`).
   - Release ready: condición única C1 cerrada.

### Fuera de scope
- Roadmap post-release (Olas 1-3 del documento): se aborda en planes separados cuando lo pidas.
