# Estado actual del roadmap Quick Wins — Facturación

**Base:** v13.312.27 en producción. Tanda 1 (QW1-QW4) y Tanda 2 (QW5/QW6/QW8) ya están implementadas. QW7 fue omitido por instrucción explícita en el plan vigente.

## Qué ya está hecho

| Tanda | QW | Estado | Versión |
|---|---|---|---|
| Tanda 1 | QW1 · PDF/CSV estado de cuenta | ✅ En producción | v13.312.26 |
| Tanda 1 | QW2 · REP en portal + auto-envío | ✅ En producción | v13.312.26 |
| Tanda 1 | QW3 · Badge "Enviada" en Emitidas | ✅ En producción | v13.312.26 |
| Tanda 1 | QW4 · Columna Archivos en ≥lg | ✅ En producción | v13.312.26 |
| Tanda 2 | QW5 · TC DOF Banxico en Nueva Factura (+ EUR) | ✅ En producción | v13.312.27 |
| Tanda 2 | QW6 · Resumen de faltantes junto al botón disabled | ✅ En producción | v13.312.27 |
| Tanda 2 | QW7 · Menú ⋮ por fila con acciones no destructivas | ❌ Omitido deliberadamente | — |
| Tanda 2 | QW8 · Envío masivo email + acción Enviar en PorEnviar | ✅ En producción | v13.312.27 |

## Qué falta

- **Tanda 3 completa:** QW9, QW10, QW11, QW12. Ninguno está implementado todavía.
- **QW7 (opcional):** sigue fuera de alcance a menos que se revierta la decisión.

## Plan propuesto — Tanda 3 (QW9-QW12)

### QW9 · Aging A/R por cliente con export CSV
Copiar el patrón existente de `CxpAging.tsx` para crear `CxcAging.tsx` (o equivalente dentro del módulo de facturación/cuentas por cobrar). Mostrar buckets 0 / 1-30 / 31-60 / 61-90 / 90+ días por cliente con botón de export CSV.

- Archivos: `src/features/cxc/routes/CxcAging.tsx` (nuevo), servicio de aggregación de saldos, hook reutilizable basado en `useCxpAging`.
- Esfuerzo: 2-3 días.

### QW10 · Recordatorios manuales de cobranza (dunning manual)
La edge `cxc-recordatorios` ya devuelve candidatos. Construir una bandeja de recordatorios agrupados por nivel (T-3 / T+7 / T+15) y permitir disparar envío manual vía `process-email-queue`. Sin automatización programada (eso es Ola 1).

- Archivos: nueva vista de recordatorios, hook `useRecordatoriosCobranza`, integración con la cola de emails.
- Esfuerzo: 3-4 días.

### QW11 · Fixes de accesibilidad en diálogos fiscales
Aplicar `FormField` (genera id y asocia label) a los Selects Radix de los diálogos de timbrado, cancelación, notas de crédito y pago. Revisar y corregir contraste de `text-warning` (ámbar) y eliminar `text-2xs` en información clave.

- Archivos: `DialogTimbrar`, `DialogCancelar`, `DialogNotaCredito`, `DialogRegistrarPago`, hojas de estilo relevantes.
- Esfuerzo: 1-2 días.

### QW12 · Envío de estado de cuenta por email
Reutilizar el PDF/CSV conectado en QW1 y adjuntarlo al flujo transaccional de emails, usando la misma infraestructura de `factura-reenvio` / `process-email-queue`.

- Archivos: `ExportActions.tsx` (añadir botón "Enviar"), servicio de envío de statements, plantilla de email.
- Esfuerzo: 1 día (depende de QW1, ya hecho).

## Dependencias y notas

- QW12 requiere QW1 (ya implementado).
- QW10 es la semilla de la Ola 1 (automatización de dunning). Se deja sin scheduler por ahora.
- QW7 sigue fuera de alcance a menos que el usuario decida revertir la exclusión.

## Alternativas

Si prefieres no abrir toda la Tanda 3 de golpe, podemos:

1. Tomar solo **QW9 + QW11** (paridad visible con CxP + a11y rápida, ~3-4 días).
2. Tomar solo **QW12** (cierra el ciclo de statements, ~1 día).
3. Reincorporar **QW7** y dejar Tanda 3 para después.

Dime qué opción prefieres para continuar.