# Roadmap: flujo de cotización + Handover

- [x] Conservar el borrador automático y «Aceptada» hasta confirmar el embarque; corregir Kuartz y validar la transición.

- [x] Mostrar la ficha de handover en el detalle de cotización para Administración y Vendedor/KAM; conservar acceso de Operaciones y aislamiento por empresa.

- [x] Fase 1: Tipo de operación y Sector económico en la solicitud; datos de la solicitud pasan solos a la cotización (mercancía, IMO, estibable, peso en kg, notas, tipo, sector).
- [x] Fase 2: obligatorios al enviar, tipo de solicitud automático, complejidad 36 h / 48 h automática, cambio del gerente con justificación (8 h para ampliar), avisos y más respuestas tras responder.
- [x] Fase 3 (autorización): solicitar/autorizar con margen mínimo, aviso a admin/gerente comercial, envío bloqueado sin autorización, handover al autorizar.
- [ ] Fase 3b: prospecto sólo borrador + "Pedir alta como cliente"; exigir oportunidad "En cotización" a clientes generales. — espera confirmación (choca con "Convertir a Cliente" tras aceptar).
- [x] Fase 4: botón "Cotizar y guardar tarifa" (coordinador/gerente de operaciones) para clientes especiales; sus cotizaciones se autorizan solas al enviar/aceptar y generan el handover.
- [x] Fase 5: Handover al aceptar la cotización: coordinador por turno + aviso con ficha al coordinador y gerente de operaciones. (Ahora se dispara al autorizar.)
- [x] Corregir vencimiento y transiciones históricas de cotizaciones de prospecto sin permitir enviar borradores nuevos.
- [x] Excluir gerentes de operaciones del coordinador fijo del cliente; conservarlos en la reasignación del handover.
- [x] Registrar 0042–0048 en `drizzle/replay.json` y regenerar baseline.
- [ ] Revisar falla previa de `supabase/tests/actualizar_cierre_periodo_rpc.sql` (organización ajena) en reconstrucción local parcial.
