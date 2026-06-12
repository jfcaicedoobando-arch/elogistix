## Problema

El job **Coverage merge & report** falla porque la cobertura real bajó ligeramente:

- `lines: 28.56%` vs umbral `29%`
- `statements: 28.56%` vs umbral `29%`
- `functions: 45.83%` ✓
- `branches: 66.98%` ✓

Sólo statements/lines incumplen, por 0.44 puntos.

## Opciones

1. **Bajar el umbral a 28** (rápido, desbloquea CI ya). Riesgo: pierde 1 punto de protección hasta el próximo sprint que vuelva a subirlo.
2. **Añadir tests** a archivos con 0% cobertura (`services/embarques/*FinancieraS.ts`, `services/facturas/notasCredito.ts`, `services/proforma/crud.ts`, `services/proveedor/index.ts`, `services/usuario/index.ts`, varios `src/types/*`) para volver ≥29%. Más trabajo, varias horas.

Recomiendo **Opción 1** ahora y abrir un follow-up para recuperar terreno. El comentario del config ya prevé re-sincronizar con la cobertura real.

## Cambios

### `vitest.config.ts`
- `thresholds.lines: 29 → 28`
- `thresholds.statements: 29 → 28`
- Actualizar comentario para reflejar la nueva línea base (28/45/65) y mantener la nota de meta Fase 1 (40/55/58/70).

### `src/constants/appVersion.ts`
- `APP_VERSION → 12.92.7`

### `CHANGELOG.md`
- Entrada `## [12.92.7] - 2026-06-12`: "CI: ajusta umbral de cobertura a 28% (lines/statements) tras drift menor; mantiene functions=45, branches=65. Pendiente recuperar a 29% añadiendo tests a `services/embarques/*Financieras`, `services/facturas/notasCredito`, `services/proforma/crud`, `services/proveedor`, `services/usuario`."

## Validación

CI ya reporta los números reales; con el umbral ajustado el job pasa sin volver a correr la suite localmente.

¿Confirmas la Opción 1, o prefieres que añada tests (Opción 2)?
