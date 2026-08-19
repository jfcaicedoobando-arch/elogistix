# Plan de acción — cierre pre-release (desde v13.684.1)

Revisé el estado real del código contra el plan de olas subido. Las olas 1, 2 y 3 están cerradas casi por completo; lo que queda es pulido visual, KPIs y robustez.

## Ya verificado como hecho (no se vuelve a tocar)

- Ola 1: rate-limit público en `tracking-public` (usa `limitarPeticionesPublicas`).
- Ola 2: cantidades fiscales sin truncar, fechas con helpers `dateOnly`, MSDS protegido en UPDATE (`services/wizard.ts`), totales de factura sólo en BD (`recalcularTotalesFactura` delega a la RPC).
- Ola 3: tokens `--aging-1..5` en claro y oscuro, `StatusBadge` canónico, `CargaGuard` adoptado en las rutas principales, `getEstadoColor` eliminado.

## Ola A — Cierre de bloqueantes restantes (primero)

1. `.env` sigue en el índice de git aunque está en `.gitignore`. Es una operación manual de git (`git rm --cached .env` + limpieza de historial + rotación de llaves publicables); yo no puedo ejecutarla. Queda documentada como pendiente tuyo.
2. `demo-access`: no resetear la contraseña del usuario demo si no cambió, y registrar el abuso del bucket de rate-limit para que se vea en monitoreo.

## Ola B — Fechas y dinero residual (KPIs correctos)

3. `useTraspasoForm` usa `new Date()` del navegador: cambiar a "hoy" en CDMX con los helpers centralizados de fecha.
4. KPI "liquidado del mes" de comisiones: calcularlo desde `liquidaciones_comision.fecha_pago`.
5. Estado de Resultados por modo: resolver el modo real de las notas de crédito desde su factura padre en lugar del fallback marítimo.
6. Una sola definición de "por vencer" (hoy conviven -3 y -7 días entre el cálculo de estatus y el KPI).
7. `calcularTotal` de CxP con `roundMoney` y `?? null` normalizado en `detectarCambioSensible` para no disparar re-aprobaciones falsas.
8. `saldoDespuesDeAplicar`: cuando el resultado es estimado (monedas distintas), nunca marcar la factura como cubierta.
9. FIFO de pagos en lote: desempatar vencimientos nulos por `fecha_emision`.
10. `registrarPagoProveedor` transaccional vía RPC, igual que el pago en lote.

## Ola C — Robustez y edge cases

11. Filtro de cotizaciones null-safe y esquema que acepte nulos normalizados.
12. `try/catch` con `notifyError` en el diálogo de subida de factura entrante.
13. Wizard de cotización con validación zod por paso (`zodResolver`) y guarda de salida con cambios sin guardar.
14. Búsqueda de listados con debounce y aviso/paginación cuando se topa el límite de filas.
15. Cobranza: mover el filtro de estatus a la RPC en lugar de filtrar en memoria.
16. `MoneyInput` con `null` en vacío y rango máximo.
17. Cambio de organización: redirigir a `/inicio` cuando la ruta trae `:id`, y acotar el detalle por `organization_id`.

## Ola D — Pulido visual fino y modo oscuro

18. Componente `ChartTooltip` compartido (no existe hoy) aplicado a las gráficas de Operaciones y Flujo Proyectado.
19. Panel de alertas de embarques con borde/fondo suaves + icono; badges inline a `Badge size="xs"`.
20. Portal y portal-agente con `PageContainer` y tipografía `text-display`; `StatTile` compartido; micro-copy y CTAs normalizados.

## Notas técnicas

- Cada ola se entrega por separado con bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Todo cambio de KPI/dinero lleva prueba de regresión; los cambios de UI se validan con los guardrails de arquitectura y los tests existentes.
- No se bajan umbrales de cobertura: el código nuevo llega con sus tests.

## Sugerencia de arranque

Empezar por Ola B (dinero visible en demos) y en paralelo Ola A punto 2, dejando el punto 1 para tu ejecución manual en git.
