# Estado de la auditoría (88 hallazgos) y plan de lo que falta

## Ya corregido (verificado)

**Wave 0 — bloqueantes: 17/17 cerrados** (v13.524.0 + verificación de código en este turno)
BL-01, BL-02, BL-04, N1, EF-01, EF-02, EF-03, EF-04, FE-01, UIA-01, UIA-02, UIA-03, UIA-04, UIA-05, UX-01, UX-02, UIB-04.

**Wave 1 — 6/32 cerrados** (v13.525.0)
BL-03, BL-05, BL-06 (los de la sub-ola 1), más BL-07, BL-08, BL-09 que en realidad pertenecían a Wave 2 y se adelantaron.

Total aplicado: **23 de 88**.

## Lo que falta

### Wave 1 (P2) — 29 pendientes
- Edge functions: EF-05, EF-06, EF-08, EF-09
- Frontend/negocio: FE-02, FE-03, FE-04, FE-05, FE-06, FE-07, FE-10 (decisión de producto), FE-11
- UI/UX: UX-03, UX-04, UX-05
- UI dinámica: UIA-06, UIA-07, UIA-08, UIA-09, UIA-11
- UI interna B: UIB-01, UIB-02, UIB-03, UIB-06, UIB-07, UIB-08 (legal), UIB-09, UIB-11, UIB-15

### Wave 2 (P3 / quick wins) — 36 pendientes
BL-10, BL-11, EF-07, EF-10, EF-11, EF-12, EF-13, FE-08, FE-09, FE-12, TC-01..TC-04, UX-06..UX-14, UX-EXT, UIA-10, UIA-12..UIA-17, UIB-10, UIB-12..UIB-14, N2 (informativo).

## Plan propuesto: continuar Wave 1 en sub-olas

Cada sub-ola = 5-7 hallazgos, agrupados por frente para no mezclar riesgos, con verificación (`typecheck`, `lint`, tests) y entrada en `CHANGELOG.md` + bump de `APP_VERSION` al cerrar cada una.

1. **Sub-ola 2 — Tesorería / pagos (frontend):** FE-02, FE-03, FE-06, FE-07, UIA-06
2. **Sub-ola 3 — Fechas y listados:** FE-04, FE-05, FE-11, UIA-07, UIA-08
3. **Sub-ola 4 — Edge functions:** EF-05, EF-06, EF-08, EF-09
4. **Sub-ola 5 — UX y accesibilidad:** UX-03, UX-04, UX-05, UIA-09, UIA-11
5. **Sub-ola 6 — UI interna B:** UIB-01, UIB-02, UIB-03, UIB-06, UIB-07, UIB-09, UIB-11, UIB-15
6. **Decisiones de producto (no código):** FE-10 (¿el rol `tesorero` registra pagos?) y UIB-08 (texto legal) — se consultan contigo antes de tocarlos.

Wave 2 queda como backlog posterior, ordenada por costo.

## Notas técnicas
- Los packs por línea viven en `docs/audit-fixes/` y cada hallazgo trae diff propuesto; se usa como fuente pero se re-valida contra el código actual antes de aplicar (varios ya estaban resueltos sin quedar registrados por ID en el changelog).
- Los cambios de base de datos se aplican como migraciones nuevas (no se editan migraciones existentes) respetando GRANT + RLS.
- El linter de este entorno tarda >120 s; se corre con timeouts altos al cerrar cada sub-ola.
