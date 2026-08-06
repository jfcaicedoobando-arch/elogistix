# Auditoría visual: Detalle de factura de proveedor (badges)

Revisé la pantalla en Full HD (1920×1080) con la factura FP-000095 (HK LS LIMITED, vencida, aprobada, sin pagos).

## Cómo está armada hoy

La página tiene 4 capas de información apiladas antes de llegar al contenido:

```text
[← Volver]
FP-000095  [Vencida] [+34 d]        <- badge primario + chips (EstadoFacturaCxPCell)
HK LS LIMITED · Folio prov. · Expedida · Exp.
[✓ Borrador]—[✓ Vigente]—[Aprobada]—[Pagada]   <- stepper de ciclo de vida
TOTAL | PAGADO | IMPORTE PENDIENTE | VENCE EL (34 días de atraso)   <- cinta KPI
                                   [• APROBADA] [Registrar pago] [...]  <- barra de acciones
```

El bloque de badges del encabezado reutiliza tal cual el componente hecho para la **tabla** de facturas (`EstadoFacturaCxPCell`), que fue diseñado para comprimir 4 columnas en una celda: puede mostrar hasta 5 chips (Parcial · +N d · NC · SAT ✓ · Prog. DD/MM) más un chip "+N", y esconde el detalle en un tooltip.

## Hallazgos (verificados en pantalla)

1. **El atraso se repite 4 veces.** Badge "Vencida", chip "+34 d", KPI "34 días de atraso" y, en la pestaña fiscal, otro chip "+34 D" junto a la fecha de vencimiento.
2. **Señales contradictorias.** El badge dice "Vencida" mientras el stepper marca "Vigente" en verde con check. Para el usuario, dos verdades distintas del mismo estado.
3. **"Aprobada" duplicada.** Aparece como paso del stepper y como chip verde "• APROBADA" en la barra de acciones.
4. **Chips de tabla en una página amplia.** NC, SAT ✓ y Prog. de pago ya tienen su lugar propio en el detalle (pestaña "Notas de crédito" con contador, "Referencias fiscales" y "Programación de pago"). En el encabezado son ruido y obligan a hacer hover para entenderlos.
5. **Tooltip como único canal del detalle.** En una tabla tiene sentido; en el detalle esconde información que ya está visible más abajo.

En resumen: la información es correcta, pero está repetida en 3-4 lugares distintos, lo que hace que la vista se sienta cargada y que el usuario dude de cuál dato es el válido. Es como poner el precio de un producto en la etiqueta, en el estante y en el letrero de la entrada: no está mal, pero deja de leerse.

## Propuesta de cambios (solo presentación)

**A. Encabezado: un solo badge de estado.**
Añadir a `EstadoFacturaCxPCell` un modo `variant="detalle"` que muestre únicamente el badge primario (Vencida / Pagada / Cancelada / Por pagar), sin chips secundarios ni tooltip. La tabla sigue usando el modo actual sin cambios.

**B. Stepper coherente con el estado real.**
Corregir `resumenFacturaRecibida` para que, cuando la factura está vencida con saldo, el paso de vigencia refleje el atraso (tono destructivo) en lugar de un check verde de "Vigente". Cancelada mantiene su tratamiento actual.

**C. Quitar la duplicación de "Aprobada".**
Retirar el chip `EstadoAprobacionDot` de la barra de acciones del detalle (el stepper ya comunica la aprobación). Se conserva en los modales, donde no hay stepper.

**D. El atraso vive en un solo lugar del detalle.**
Mantener el atraso en el KPI "Vence el / N días de atraso" y quitar el chip "+34 d" del encabezado. En la pestaña fiscal se conserva junto a la fecha de vencimiento, que es su contexto natural.

**E. Señales fiscales donde corresponden.**
SAT ✓ y NC dejan de ser chips del encabezado: SAT queda en "Referencias fiscales" (ya existe) y NC en el contador de la pestaña "Notas de crédito" (ya existe). "Prog. de pago" queda en su sección de la pestaña fiscal.

## Detalles técnicos

- Archivos a tocar: `src/features/cxp/components/EstadoFacturaCxPCell.tsx` (nueva prop `variant`), `src/features/cxp/components/detalle/FacturaProveedorHeader.tsx`, `src/features/cxp/components/DialogDetallePagosProveedor.actionbar.tsx`, `src/lib/domain/documentoEstados.ts` (paso de vigencia).
- Sin cambios de datos, RPCs ni RLS; nada de lógica de negocio.
- Verificación visual con Playwright a 1920×1080 en las pestañas Conceptos, Proveedor y datos fiscales, y Pagos, más un caso Cancelada y uno Pagada para confirmar que ningún estado pierde señal.
- Registrar el cambio en `CHANGELOG.md` y subir `APP_VERSION`.
