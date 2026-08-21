# Ola 2 — Fase B (lo que queda de comisiones)

## Estado real hoy (verificado)

Ya resuelto en la Fase A o ya existía en el proyecto:

- O2.1 prorrateo por venta neta del embarque, O2.2 regla de cierre, O2.5 idempotencia de anticipos, O2.6 ciclo de vida de liquidaciones.
- O2.9 vencimiento de cotizaciones: el cron `expirar_cotizaciones_diario` ya marca Enviada → Vencida por fecha de vigencia.
- O2.11.3 demoras reactivas: ya existe el disparador sobre contenedores que recalcula demoras al cambiar fecha de descarga o devolución.

Pendiente de verdad (6 puntos):

| Punto | Qué falta hoy | Riesgo |
|---|---|---|
| O2.3 | Al aplicar una nota de crédito al cliente, nada recalcula la comisión ya devengada | Se paga comisión sobre dinero que el cliente no pagó |
| O2.4 | El cálculo de comisión sólo mira el embarque directo de la factura; en facturas consolidadas (varios embarques) guarda comisión sin vendedora y en silencio | Comisiones perdidas sin aviso |
| O2.7 | En cobranza no se calcula la diferencia cambiaria (en pagos a proveedor sí) | Utilidad en multimoneda incompleta |
| O2.8 | El auto-ajuste de estado del embarque escribe directo en la tabla, saltándose el candado de documentos | Un embarque puede "arribar" sin BL/DODA |
| O2.10 | Al mandar un embarque a la papelera, la cotización queda ligada a un embarque borrado | Cotización huérfana, no se puede reusar |
| O2.11 | Faltan dos tareas automáticas: reproceso diario de comisiones pendientes y verificación semanal de UUIDs ante el SAT | Trabajo manual y cancelaciones del SAT descubiertas tarde |

## ¿Vale la pena terminarla?

Sí, pero por partes. O2.3, O2.4 y O2.8 son dinero y control operativo: son las que justifican el esfuerzo. O2.10 y O2.11 son barato-y-útil. O2.7 conviene decidirlo antes de programarlo (ver preguntas).

Propuesta: dos entregas.

- **B1 (dinero y candados):** O2.3, O2.4, O2.8, O2.10.
- **B2 (automatización):** O2.11.1, O2.11.2 y, si se decide soportarla, O2.7.

## Qué se construye

### B1

1. **Notas de crédito bajan la comisión (O2.3).** Disparador en notas de crédito de cliente: al quedar Aplicada (o al cambiar su monto), se recalcula la comisión de los pagos de esa factura usando la venta neta de notas de crédito. Si la comisión ya está liquidada no se toca el histórico: se registra un ajuste pendiente para la siguiente liquidación.
2. **Facturas consolidadas (O2.4).** El cálculo resuelve los embarques por el puente factura–embarques activos y reparte la comisión entre ellos según su venta. Si no se puede resolver ningún embarque, la fila va a la cola de recálculo con etapa `consolidada_sin_embarque`, en lugar de guardarse en cero sin aviso.
3. **Auto-sync de estado respeta el candado (O2.8).** El ajuste automático de estado pasa a usar la RPC de avance de estado con identificador de solicitud estable, heredando el candado de documentos, el bloqueo de fila y la guarda optimista. Si la RPC rechaza el avance por documentos faltantes, la UI lo muestra como aviso, no como error.
4. **Papelera libera la cotización (O2.10).** El disparador de vínculo cotización–embarque también reacciona al envío a papelera: desliga la cotización y la deja en Aceptada.

### B2

5. **Reproceso diario de comisiones pendientes (O2.11.1).** Tarea programada que corre la función ya existente (idempotente, nunca toca liquidadas) y deja registro en bitácora.
6. **Verificación SAT semanal (O2.11.2).** Tarea programada que llama la función de verificación en lotes por organización y, si detecta cancelaciones, avisa al área contable por notificación interna.
7. **Diferencia cambiaria en cobranza (O2.7)** — sólo si se decide soportarla: espejo de la lógica de pagos a proveedor en el disparador de pagos de factura.

## Detalles técnicos

- Migraciones nuevas con timestamp; errores de dominio con prefijo `LC_`; RPC `SECURITY DEFINER SET search_path TO 'public'` con `REVOKE`/`GRANT` explícitos (H6).
- Test de regresión SQL por punto, agregados a `supabase/tests/ola2_comisiones_regresion.sql` o a un archivo nuevo `ola2_faseb_regresion.sql`: NC del 20% baja el devengado al 80%; consolidada de 2 embarques genera 2 devengadas prorrateadas; auto-sync sin BL/DODA no llega a Arribo; soft-delete de embarque devuelve la cotización a Aceptada.
- Frontend: reemplazar `actualizarEstadoEmbarque` en el camino de auto-sync por la RPC (`useSyncEstadoEmbarque` en `mutations/useEstadoEmbarque.ts`), conservando `useAvanzarEstadoEmbarque` como acción manual.
- Bump de `APP_VERSION` y entrada en `CHANGELOG.md` por entrega.

## Preguntas que hay que cerrar antes de programar

1. Comisión ya **Liquidada** y luego llega una nota de crédito: ¿descuento en la siguiente liquidación (recomendado) o no se ajusta?
2. Diferencia cambiaria en cobranza: ¿se calcula, o se retira el campo del contrato y se documenta que no aplica?
