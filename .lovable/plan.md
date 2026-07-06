
# Mejoras al módulo de Compras

Propuestas derivadas del walkthrough. Priorizadas por **impacto en el día a día del contador** vs esfuerzo. Divididas en tres olas para poder aprobar por partes.

Analogía: hoy el módulo es una **caja de herramientas ordenada**; estas mejoras son los **atajos y candados** que un contador experimentado empieza a extrañar después de la primera semana de uso.

---

## Ola A — Alto impacto, bajo esfuerzo (empezar por aquí)

### A1. Ingesta directa de XML/CFDI del proveedor
**Hoy:** capturas manualmente proveedor, folio, fechas, montos, IVA, moneda, subes el PDF aparte.
**Propuesta:** botón *"Subir XML"* que parsea el CFDI y **pre-llena todo**: RFC (busca o crea proveedor), folio, fecha, subtotal, IVA, retenciones, total, moneda, tipo de cambio, UUID fiscal. El usuario solo confirma y liga al embarque.
**Beneficio:** captura pasa de ~2 min a ~15 s por factura. Elimina errores de dedo.
**Nota:** hay un patrón similar en `client-csf-automation` (parsing con Gemini) que puede reutilizarse.

### A2. Detección de duplicados al capturar
**Hoy:** puedes capturar dos veces la misma factura (mismo proveedor + mismo folio) sin aviso.
**Propuesta:** al escribir `proveedor + folio_proveedor`, si ya existe una factura en la organización, **bloquear con banner rojo** y ofrecer link "Ver factura existente".
**Beneficio:** evita pagos duplicados — el error más caro que puede cometer un contador.

### A3. Alerta de saldo negativo por sobrepago
**Hoy:** validación bloquea pagar más que el saldo, pero si registras dos pagos parciales muy rápido puede haber race conditions.
**Propuesta:** validación en el servidor (RPC `registrar_pago_proveedor`) que rechace si `pagado + monto > total`. Feedback claro al usuario.
**Beneficio:** integridad contable a prueba de doble-click.

### A4. Botón "Marcar como pagada sin registrar movimiento"
**Hoy:** para saldar una factura vieja (ej. compensación, quita, error histórico) hay que registrar un pago ficticio.
**Propuesta:** acción en el detalle "Cerrar factura" con motivo obligatorio (compensación / condonación / ajuste histórico / duplicada) y comentario. Requiere rol contador+.
**Beneficio:** limpieza de aging sin ensuciar el histórico de pagos.

---

## Ola B — Alto impacto, esfuerzo medio

### B1. Aging por proveedor (drill-down)
**Hoy:** `/compras/aging` muestra cubetas globales.
**Propuesta:** click en una cubeta abre modal con el desglose por proveedor y sus facturas. Botón "Exportar a Excel" para llevarlo a la junta con dirección.
**Beneficio:** convierte el reporte en herramienta accionable ("hay que hablar con Naviera X, concentra 40% del +90").

### B2. Conciliación: exportar diferencias como CSV para el operativo
**Hoy:** el contador ve la conciliación pero cada disputa se maneja fuera del sistema (WhatsApp, correo).
**Propuesta:** en `/compras/conciliacion`, checkbox por fila + botón "Enviar a operaciones para revisar" que crea una notificación interna (`notificaciones_internas`) al operativo del embarque con el detalle.
**Beneficio:** el círculo de disputa queda dentro del sistema, con bitácora.

### B3. Programación de pagos ("mi lista de mañana")
**Hoy:** en `/compras/por-pagar` el contador elige factura por factura.
**Propuesta:** selección múltiple + acción "Programar para pago" con fecha objetivo. Se genera un **layout SPEI/BBVA** exportable (ya existe `bbva_movimientos`, aprovechar).
**Beneficio:** un solo archivo al banco en lugar de meter pagos uno por uno.

### B4. Aprobación en lote
**Hoy:** cada factura se aprueba individualmente.
**Propuesta:** en `/compras/por-aprobar`, checkbox por fila + botón "Aprobar seleccionadas" (con confirmación mostrando total y conteo). Rechazo sigue siendo individual (requiere motivo).
**Beneficio:** gerente aprueba 20 facturas rutinarias en 10 segundos, no en 5 min.

---

## Ola C — Estratégico, esfuerzo mayor

### C1. Portal de proveedores (auto-servicio de facturas)
**Hoy:** el proveedor manda facturas por correo y alguien las captura.
**Propuesta:** portal `/portal-proveedor/*` donde el proveedor sube su XML+PDF directamente contra un embarque (identifica por número BL o expediente). La factura entra en estado `pendiente_captura` para que el contador la revise y apruebe la ingesta.
**Beneficio:** elimina el intermediario. Ya existe patrón similar en `portal-agente`.

### C2. IA de matching mejorada
**Hoy:** matcher usa similitud de texto + monto (60/40).
**Propuesta:** agregar señales adicionales — histórico ("este proveedor siempre te factura estos 3 conceptos por embarque"), fecha (facturas emitidas cerca del ETD suelen ser flete, cerca del ETA suelen ser destino), rango de monto habitual por concepto. Bajar tiempo de captura + subir score de auto-selección.
**Beneficio:** matching pasa de asistente a co-piloto real.

### C3. Vista "Estado de cuenta con proveedor"
**Hoy:** desde `/compras/proveedores/:id` ves datos pero no un estado de cuenta imprimible.
**Propuesta:** pestaña "Estado de cuenta" con facturas, pagos, NCs y saldo, exportable a PDF con formato para mandar al proveedor cuando reclama.
**Beneficio:** cierra el ciclo de comunicación con proveedores.

---

## Fuera de alcance (no proponer)
- Timbrado / emisión CFDI de proveedor — es responsabilidad del proveedor, no nuestra.
- Contabilización a pólizas SAT completas — se resuelve con el layout contable que ya existe.
- Cambios visuales al sidebar o navegación — la unificación bajo `/compras/*` ya quedó bien en 13.175.0.

---

## Cómo procedemos

Cada ola cabe en 1–3 PRs. Sugerencia:
1. Aprobar **Ola A completa** primero (bajo riesgo, alto valor).
2. Con Ola A viva, decidir Ola B (B3 requiere alinear con tesorería).
3. Ola C se evalúa después de 2–4 semanas de uso real de A+B.

Si apruebas este plan de mejoras, dime **cuál (o cuáles) de la Ola A quieres que arranque primero** y lo implemento en el siguiente turno.
