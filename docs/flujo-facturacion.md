# Flujo Proforma → Factura → Timbrado → Pago → REP

Documenta el flujo "fiscal" introducido entre las versiones **13.137.0** y
**13.137.2**, que reemplaza progresivamente al flujo manual previo
("Marcar facturada") al integrar Facturapi como PAC para emitir CFDI 4.0 y el
Complemento de Pagos (REP).

## Vista general

```
┌────────────┐  Convertir ┌────────────┐  Timbrar  ┌────────────┐
│  Proforma  │ ─────────▶ │  Factura   │ ────────▶ │   CFDI     │
│ (aprobada) │            │ (borrador) │           │  (PUE/PPD) │
└────────────┘            └────────────┘           └────────────┘
      │ N:1 (fusión)             │                       │ pago
      ▼                          │                       ▼
                                 │                  ┌────────────┐
                                 │     PPD          │    REP     │
                                 │ ──────────────▶  │ (auto)     │
                                 │                  └────────────┘
```

## Fases del plan

| Fase | Alcance                                                                                | Estado      |
| ---- | -------------------------------------------------------------------------------------- | ----------- |
| 1    | Migración SQL: `convertir_proformas_a_factura` + vista `v_proforma_factura_link`.      | ✅ 13.137.0 |
| 2    | Modal `ConvertirAFacturaDialog` + servicio `convertirAFactura.ts`.                     | ✅ 13.137.0 |
| 3    | Selección múltiple en `TabProformas` para fusionar N proformas → 1 factura.            | ✅ 13.137.2 |
| 4    | UX threading: al convertir, `FacturaDetalle` abre auto el diálogo de Timbrado.         | ✅ 13.137.2 |
| 5    | REP automático tras pago en facturas **PPD** ya timbradas.                             | ✅ 13.137.2 |
| 6    | Documentación + futuras KPIs (proformas convertibles, REPs pendientes).                | ✅ 13.137.2 |

## ¿Qué mide cada KPI/bandeja del cockpit `/facturacion`?

Los tres números que verás en la página miden **puntos distintos** del
embudo — no cuadran entre sí, y ese es el diseño. Alineación aplicada en
13.213.0:

| KPI / Bandeja                | Fuente                                                                                | Qué mide                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| KPI **Proformas por revisar** | `proformas` con `estado_revision = 'pendiente'`                                       | Proformas creadas desde embarques, esperando aprobación **interna**         |
| KPI **Listas para facturar**  | `proformas` con `estado_revision = 'aprobada'` y `factura_id IS NULL`                 | Aprobadas listas para convertir a factura (CFDI). Cuadra con `/proformas`   |
| Bandeja **Embarques sin factura** | `useHuecoFacturacion` (ETD > hoy − 5d, sin CFDI por expediente)                     | Embarques cerrados que aún no tienen factura (haya o no proforma)           |
| Bandeja **Proformas listas** | Mismo query que el KPI "Listas para facturar"                                         | Lista accionable con "Convertir a factura" (usa `useConvertirProformaDirecto`) |
| Bandeja **Por timbrar**      | `facturas` en Borrador post 01/07/2026 sin `facturapi_id`                             | Borradores creados en el sistema pendientes de mandar a FacturApi           |


## Punto a punto

### 1. Conversión (1:1 o N:1)

- **Origen**: una o varias proformas del **mismo cliente**, no marcadas como
  `facturada`. La RPC `convertir_proformas_a_factura(uuid[], …)` valida que
  todas pertenezcan al mismo cliente y misma organización.
- **Destino**: una factura **borrador** (sin `uuid_fiscal`), lista para
  timbrar. Los conceptos se copian con su `cantidad/precio_unitario/iva`.
- **UI**:
  - Botón individual en `ProformaDetalleCards` (1:1).
  - Casillas + barra flotante en `TabProformas` (N:1 con verificación de
    mismo cliente).

### 2. Timbrado (Facturapi)

- `DialogTimbrarFactura` recorre los `buildChecksTimbrado` (RFC/CP/Régimen/Uso
  CFDI/Forma/Método) y llama a `facturapi-emitir` (edge function).
- Tras una conversión exitosa, `FacturaDetalle` lee `?accion=timbrar` de la
  URL y abre automáticamente el diálogo si la factura aún no tiene UUID.
- Cancelaciones via `DialogCancelarFactura` (motivos SAT 01/02/03/04).

### 3. Pago + REP automático

- `DialogRegistrarPago` registra el pago en `pagos_factura`. Si la factura es
  **PPD** y ya tiene `uuid_fiscal`, encadena `emitirRep(pagoId)` para timbrar
  el Complemento de Pagos. Errores de REP no abortan el pago: queda en
  estado `Pendiente` y puede reintentarse desde el historial
  (`PagoFacturaRow`).
- En **PUE** no se genera REP.

## Permisos

- `convertir_proformas_a_factura`: `contador`, `admin_org`, `admin`,
  `super_admin`.
- Timbrar/Cancelar factura y REP: roles con `canEdit` (mismos roles + el
  resto de operadores con permiso en el módulo).

## Servicios y archivos clave

- `supabase/migrations/*fase_1_trazabilidad.sql` — vista y RPC.
- `supabase/functions/facturapi-emitir/` y `facturapi-emitir-rep/`.
- `src/features/proformas/services/convertirAFactura.ts`
- `src/features/proformas/components/ConvertirAFacturaDialog.tsx`
- `src/features/facturacion/services/repFacturapi.ts`
- `src/features/facturacion/components/{DialogTimbrarFactura,DialogRegistrarPago}.tsx`
- `src/features/facturacion/routes/FacturaDetalle.tsx`

## Compatibilidad hacia atrás

- El flujo manual (`DialogMarcarFacturada` + folio externo) sigue disponible
  para datos históricos y proformas que no se vayan a timbrar.
- El nuevo flujo sólo se aplica a proformas **aprobadas** creadas a partir
  de 13.137.0.
