# Cotización → aceptación → embarque

Revisado el **2026-09-26**. Fuentes: feature `cotizacion`, portal, servicios
de conversiones/revalidación y RPCs SQL.

## Flujo vigente

1. Capturar cliente/prospecto, operación, ruta, mercancía y conceptos.
2. Marítimo FCL con flete exige tarifa vinculada; LCL permite el flujo de
   flete manual validado y los incoterms sin flete tienen su excepción explícita.
   No aplicar una regla “toda cotización marítima exige tarifa” sin esas ramas.
3. Revisar/envíar cotización con importes, vigencia y tratamiento fiscal resueltos.
4. Cliente responde en portal o staff autorizado registra respuesta según flujo.
5. Aceptación fija estado/versión; **no crea factura ni cobra**.
6. Desde cotización aceptada, operaciones crea embarque mediante el flujo
   de revalidación y RPC, no insert manual ni alta libre desvinculada.
7. Si cambió la tarifa, resolver severidad/decisión antes de convertir.
8. El vínculo sincroniza estado En operación y trazabilidad del embarque.

## Portal y notificaciones

El portal limita respuesta al cliente autorizado y estado permitido.
La RPC registra comentario/fechas y puede actualizar la oportunidad vinculada.
Hay notificaciones internas: no describir aceptación como seguimiento sin aviso.

No prometer entrega email sólo porque existe template/código:
depende de configuración y resultado del envío. Ver servicio
`src/features/cotizacion/services/conversiones/portal.ts`.

## Revalidación y versión

Cotización aceptada no se modifica sobrescribiendo sus costos.
Re-cotizar usa motivo y versionado; preservar versión aceptada/histórico.

- Sin cambios: conversión normal.
- Diferencia informativa: operaciones decide mantener/refrescar según reglas.
- Bloqueante: requiere resolución comercial/reaprobación.
- Precio al cliente no cambia silenciosamente al actualizar costo.

La creación debe ser atómica e idempotente, con control de vínculos/cantidad
según RPC; no repetir conversiones tras error sin comprobar el resultado.

## Roles

Creación/handoff operativos incluyen coordinador logístico y gerente de
operaciones según capacidades vigentes. No confundir crear embarque con
autorizar precio, editar costos o emitir CFDI.

Fuentes: `permissionMatrix.operaciones.ts`, `permissionMatrix.cotizaciones.ts`
y validación backend. Acceso a la ruta no implica todas sus acciones.

## Referencias

- `src/features/cotizacion/hooks/wizard/handlePaso1Crm.ts`.
- `src/features/cotizacion/services/conversiones/embarques.ts`.
- `src/features/cotizacion/services/revalidacion/`.
- `src/features/cotizacion/services/versionado/`.
- [Regla persistente de tarifa](../.lovable/memories/features/cotizacion-tarifa-first.md).
- [Revalidación](../.lovable/memories/features/revalidacion-tarifa-embarque.md).
- [Contenedores](embarques-contenedores.md).
