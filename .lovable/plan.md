# Plan: nuevo flujo Proforma → Factura → Timbrado → Pago → REP

## Objetivo

Convertir el flujo actual (proformas y facturas como entes paralelos) en una cadena lineal con trazabilidad:

```text
Proforma (aprobada) ──[Convertir]──▶ Factura (borrador)
                                         │
                                  [Timbrar manual]
                                         ▼
                                  Factura timbrada (CFDI)
                                         │
                                  [Registrar pago]
                                         ▼
                                  Pago aplicado ──auto──▶ REP timbrado (si PPD)
```

Sólo aplica a proformas **nuevas**. Las históricas se quedan como están.

---

## Fase 1 — Modelo de datos y trazabilidad

1. Agregar `facturas.proforma_origen_id` (FK a `proformas.id`, nullable) e índice.
2. Agregar `proformas.factura_generada_id` (FK a `facturas.id`, nullable, único) para evitar doble conversión.
3. Nuevo estado en `proformas.estado`: `convertida` (terminal). Reglas: sólo `aprobada` puede pasar a `convertida`.
4. Vista `v_proforma_factura_link` para reportes y para el badge "Ya facturada" en la lista de proformas.
5. Bitácora: eventos `proforma_convertida`, `factura_generada_desde_proforma`.

## Fase 2 — Conversión Proforma → Factura (manual)

1. RPC `convertir_proforma_a_factura(p_proforma_id uuid)`:
  - Valida estado `aprobada`, que no exista ya `factura_generada_id`, y que el cliente tenga datos fiscales mínimos (RFC, CP, régimen, uso CFDI).
  - Copia conceptos de `proforma_conceptos_consolidados` a `conceptos_factura` respetando moneda y tipo de cambio.
  - Crea `facturas` en estado `Borrador` con `proforma_origen_id` y `metodo_pago` heredado (PUE/PPD).
  - Marca proforma como `convertida` y guarda `factura_generada_id`.
  - Todo en una sola transacción.
2. UI:
  - Botón **"Convertir a factura"** en el detalle de la proforma (visible sólo si `aprobada` y sin factura ligada).
  - Modal de pre-flight: muestra checklist de datos fiscales del cliente, conceptos, totales y método de pago. Si falta algo, link directo al cliente/proforma.
  - Tras confirmar, redirige al borrador de factura recién creado.
3. En la lista de proformas: badge "Facturada · F-xxxx" con link a la factura.

## Fase 3 — Timbrado manual (ya existe, sólo lo hacemos primer ciudadano)

1. En el borrador de factura, el botón **"Timbrar"** ya existe (`facturapi-emitir`). Ajustes:
  - Reforzar pre-flight: validar mismo checklist que conversión más serie/folio y CSD vigente para esa org.
  - Si la factura tiene `proforma_origen_id`, prohibir edición de conceptos una vez timbrada (lock vía RLS/RPC).
2. Estados: `Borrador` → `Timbrada` → (`Pagada` | `Cancelada`).
3. En la lista de facturas: filtro "Pendientes de timbrar" para que operaciones vea la cola del día.

## Fase 4 — Pago + REP automático en PPD

1. Al guardar un `pagos_factura`:
  - Si la factura es **PUE**: no se timbra REP (no aplica).
  - Si la factura es **PPD** y está timbrada: trigger encola job y `facturapi-emitir-rep` se dispara automáticamente.
2. Manejo de errores: si el timbrado del REP falla (datos fiscales del pago incompletos, problema con FacturApi), el pago queda registrado pero se crea una alerta en la nueva bandeja **"REP pendientes"** con el detalle del error y botón **"Reintentar REP"**.
3. UI:
  - En `DialogRegistrarPago` agregar checkbox **"Timbrar REP automáticamente"** (default ON para PPD, deshabilitado para PUE).
  - En el tab de facturación del embarque, mostrar estado REP por pago: `—`, `Pendiente`, `Timbrado`, `Error`.
4. Nueva página `/facturacion/rep-pendientes` (sólo roles fiscales) con la cola de fallos.

## Fase 5 — Bandejas y dashboards

1. KPIs en el dashboard de facturación:
  - Proformas aprobadas sin convertir.
  - Facturas borrador sin timbrar.
  - Facturas PPD con saldo y sin REP al día.
2. Bandeja unificada **"Pendientes fiscales"** con tabs: Convertir, Timbrar, REP.

## Fase 6 — Documentación y rollout

1. Doc operativa en `docs/flujo-facturacion.md` con el diagrama y casos borde.
2. Actualizar `docs/facturapi-go-live.md` con el nuevo flujo lineal.
3. Cutoff: feature flag `app.proforma_to_factura_flow` por organización para activar gradualmente. Sin flag, sigue el flujo actual.
4. CHANGELOG + bump de versión por fase.

---

## Mejores prácticas que incorporamos

- **Idempotencia**: la RPC de conversión y el job de REP usan `idempotency_keys` para evitar duplicados ante reintentos.
- **Inmutabilidad post-timbre**: una vez con UUID fiscal, los conceptos no se editan; cambios requieren nota de crédito.
- **Separación de moneda**: copiamos `moneda` y `tipo_cambio` de la proforma; nunca recalculamos al convertir.
- **RLS estricta**: la RPC valida `organization_id` de la proforma vs. el del usuario.
- **Observabilidad**: cada paso emite a `bitacora_actividad` y errores de FacturApi a Sentry vía `wrapEdgeHandler`.
- **Reversibilidad controlada**: si se cancela una factura recién timbrada y la proforma sigue válida, permitir "Desvincular" para volver a convertir (con confirmación tipo ELIMINAR).

## Qué nos falta hoy (gaps detectados)

1. No hay FK entre `proformas` y `facturas` — toda la trazabilidad se perdería.
2. No hay validador previo único: cada modal valida a su modo (riesgo de timbrar con datos faltantes).
3. El REP es 100% manual hoy — fricción alta para PPD.
4. No hay bandeja de "pendientes fiscales" centralizada.
5. Los conceptos de proforma viven en `proforma_conceptos_consolidados`; los de factura en `conceptos_factura`. Necesitamos el mapper formal en la RPC de conversión.

## Riesgos y mitigaciones


| Riesgo                                       | Mitigación                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Doble conversión de una proforma             | Constraint UNIQUE en `proformas.factura_generada_id`                           |
| REP automático con datos incompletos         | Pre-flight server-side antes de llamar a FacturApi; si falla, queda en bandeja |
| Cliente sin datos fiscales bloquea operación | Modal de conversión enlaza directo al cliente para completarlos                |
| Timbrado accidental                          | Flujo manual + modal de confirmación con totales                               |


---

## Preguntas abiertas (te las dejo para después)

1. ¿Quieres que la conversión permita **fusionar varias proformas en una factura** (común cuando un cliente tiene varios embarques al mes)? Si sí, lo agregamos como Fase 2.5.  SI, que se pueda fusionar en 1 factura.
2. ¿Los roles `contador` y `admin_org` pueden convertir/timbrar, o restringimos timbrado sólo a `admin_org`? Si, contador tambien puede timbrar.
3. ¿Quieres notificación por correo al cliente cuando se timbra la factura y/o el REP? Aun no. 

Si te late, arrancamos con la **Fase 1** (modelo de datos) en cuanto aprobes.