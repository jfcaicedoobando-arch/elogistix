# Auditoría amplia del módulo Análisis

Alcance: las 4 pantallas del menú Análisis — Utilidad (/profit), Cierre mensual, Rentabilidad y Cartera y antigüedad. Solo se busca y se reporta; se corrige únicamente lo que confirme la revisión (con tu visto bueno al final de cada lote).

## Qué se revisa en cada pantalla

1. **Cifras contra la base de datos** — venta, costo, utilidad, cartera y antigüedad se recalculan en SQL directo para la org Elogistix (septiembre 2026) y se comparan con lo que muestra la pantalla.
2. **Reglas de dinero** — IVA (con/sin, nunca fijo), conversión USD/EUR con TC correcto, redondeo, cancelados/borradores/soft-delete excluidos, notas de crédito y pagos anulados.
3. **Fechas** — corte de mes en hora de México, sin desfase UTC, meses vacíos.
4. **Consistencia entre reportes** — Utilidad vs Cierre mensual vs Rentabilidad vs tablero de inicio deben dar lo mismo para el mismo mes; cartera vs Cobranza.
5. **Seguridad multi-empresa** — cada consulta/RPC filtra por organización; roles sin permiso financiero no ven montos.
6. **Robustez** — listas truncadas (límites silenciosos), errores de consulta sin mensaje, estados vacíos/carga, filtros y exportaciones (CSV/PDF) que coincidan con lo visible.
7. **Calidad de código** — archivos >200 líneas, `any`, efectos sin limpieza, consultas sin manejo de `error`.

## Entregable

Lista de hallazgos por severidad (crítico / alto / medio / bajo) con: pantalla, qué está mal, impacto en pesos o en el usuario, y propuesta de corrección. Luego corrijo por lotes los que apruebes.

## Detalles técnicos

- Código: `src/features/profit`, `src/features/reportes` (cartera, cierre, rentabilidad), sus services/RPC y las funciones SQL que consumen.
- Verificación con lecturas `read_query`, Playwright con el login de auditoría y pruebas focalizadas (`bunx vitest run` sobre carpetas tocadas, `tsgo`, `eslint`).
- Sin migraciones, publicación, cambio de versión ni CHANGELOG salvo que lo autorices; CI/RLS completos quedan para GitHub Actions.
