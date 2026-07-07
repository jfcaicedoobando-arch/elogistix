## Objetivo

Unificar la barra de acciones de los 3 detalles a los que llegan los drilldowns de las bandejas de facturación, con un patrón común: **acción primaria a la izquierda → grupo secundario visible → menú "Más acciones" (⋮) → botón destructivo aislado a la derecha**. Además, subir las acciones que hoy viven enterradas dentro de tarjetas (Registrar pago, Timbrar REP, Generar proforma) al top del detalle.

## Alcance

Los 3 destinos del drilldown:
1. `FacturaDetalle` (`/facturacion/:id`) — llega desde Por timbrar, Por enviar, Por cobrar, Vencidas, REP pendientes.
2. `ProformaDetalle` (`/proformas/:id`) — llega desde Proformas listas.
3. `TabFacturacion` del embarque (`/embarques/:id?tab=facturacion`) — llega desde Por facturar.

## Diseño del componente compartido

Nuevo componente en `src/components/shared/DetalleActionBar.tsx`:

```text
┌─────────────────────────────────────────────────────────────────────┐
│ [Acción primaria]  [Sec 1] [Sec 2]        [⋮ Más]     [Destructivo] │
└─────────────────────────────────────────────────────────────────────┘
```

Contrato (recibe listas declarativas, sin lógica de negocio dentro):

```ts
type ActionItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tone?: "default" | "destructive";
  href?: string;              // renderiza <Link> si viene
};

interface DetalleActionBarProps {
  primary?: ActionItem;       // botón sólido, 1 sola acción principal
  secondary?: ActionItem[];   // botones outline visibles (máx 3, resto va a "Más")
  moreLabel?: string;         // default "Más acciones"
  more?: ActionItem[];        // dentro de DropdownMenu
  destructive?: ActionItem;   // aislado a la derecha con divider
}
```

Reglas de composición:
- `primary` = tono `default` (botón sólido). Es la CTA fiscal/operativa del estado actual.
- `secondary` = máx **3** visibles (responsive). Del 4º en adelante el componente los empuja automáticamente a `more`.
- `more` = `DropdownMenu` con trigger `Button variant="outline" size="sm"` + icono `MoreHorizontal`. Cerrado por defecto.
- `destructive` = separado por `<Divider />`, alineado a la derecha con `justify-between` en el wrapper.
- Wrap responsivo: `flex flex-wrap items-center gap-2`. En mobile todos hacen wrap; el destructivo mantiene su divider.

## Mapeo por detalle

### 1) `FacturaDetalle`

Reescribir `FacturaDetalleActionsBar` para armar arrays y delegar en `DetalleActionBar`. Deriva de `flags` + `acuse`.

| Estado                        | primary                | secondary (visibles)                    | more (⋮)                                              | destructive         |
|-------------------------------|------------------------|-----------------------------------------|--------------------------------------------------------|---------------------|
| Borrador (sin timbrar)        | **Timbrar factura**    | —                                       | —                                                      | Eliminar borrador   |
| Timbrada, saldo pendiente     | **Registrar pago**     | Enviar email · Descargar PDF            | Descargar XML · Ver embarque · Sustituir · Cancelar    | —                   |
| Timbrada, liquidada           | **Enviar email**       | Descargar PDF                           | Descargar XML · Ver embarque · Sustituir · Cancelar    | —                   |
| Con pagos sin REP (REP pend.) | **Timbrar REP**        | Descargar PDF · Enviar email            | Descargar XML · Ver embarque · Sustituir · Cancelar    | —                   |
| Cancelada / Sustituida        | —                      | Descargar PDF · Acuse XML · Acuse PDF   | Descargar XML · Reintentar acuse · Ver embarque        | —                   |

Cambios concretos:
- **Subir `Registrar pago`** al action bar. Se pasa como callback desde `FacturaDetalle` (ya existe `setPagoOpen`). El botón del mismo nombre dentro de `FacturaPagosSection` se **elimina** para no duplicar.
- **Agregar `Timbrar REP`**: nueva prop/flag. Si `factura` está timbrada, tiene al menos 1 pago aplicado y falta el complemento de pagos, aparece como `primary`. Callback abre el diálogo existente de REP (revisar `useTimbrarComplementoPago` / `DialogoTimbrarREP` — si no existe con ese nombre exacto, agregar `TODO` técnico y lanzar toast placeholder para que el hook actual se conecte en el mismo turno).
- La lógica de decisión (`sinTimbrar`, `liquidada`, `repPendiente`, `estaCancelada`) sale de `deriveFacturaFlags` extendido con `repPendiente` (nueva propiedad derivada de `pagos.length > 0 && !factura.rep_timbrado`).

### 2) `ProformaDetalle`

Reescribir `AccionesProforma` para usar `DetalleActionBar`:

| Estado                        | primary                | secondary                         | more (⋮)              | destructive |
|-------------------------------|------------------------|-----------------------------------|-----------------------|-------------|
| Borrador / Enviada a cliente  | **Convertir a factura**| Descargar PDF · Enviar al cliente | Marcar aceptada · Marcar rechazada | — |
| Aceptada (lista)              | **Convertir a factura**| Descargar PDF · Enviar al cliente | —                     | — |
| Facturada                     | —                      | Descargar PDF · Ver factura       | —                     | — |
| Rechazada                     | —                      | Descargar PDF                     | Enviar al cliente     | — |

### 3) `TabFacturacion` del embarque

Insertar un `DetalleActionBar` **arriba** del `FlujoFacturacionStepper` (antes no existía barra unificada):

| Contexto                                     | primary                       | secondary                    | more (⋮)          | destructive |
|----------------------------------------------|-------------------------------|------------------------------|-------------------|-------------|
| Hay conceptos pendientes (sin proforma)      | **Generar proforma**          | Ver historial de proformas   | Ver facturas      | — |
| Todo en proforma, ninguna facturada          | —                             | Ver proformas · Ver facturas | —                 | — |
| Ya facturado todo                            | —                             | Ver facturas                 | —                 | — |

Los botones "Ver proformas / Ver facturas" hacen scroll a las secciones (`useFocusSection`), reutilizando `registerRef`. `Generar proforma` abre el `DialogGenerarProforma` existente con filtro `'todos'` (mismo callback que hoy usa `ResumenConceptosVenta`).

## Cambios técnicos por archivo

1. **Nuevo** `src/components/shared/DetalleActionBar.tsx` (< 200 líneas)
   - Renderiza primary + secondary + more + destructive según contrato.
   - Usa `DropdownMenu` de shadcn para "Más acciones" (cerrado por defecto).
   - Alinea destructivo a la derecha con `ml-auto` + `Divider`.

2. **Nuevo** `src/components/shared/DetalleActionBar.test.tsx`
   - Overflow: con 5 secondary, 2 quedan visibles + 3 caen en "Más".
   - Loading en un ítem deshabilita ese botón.
   - Destructivo no aparece en "Más".

3. **Editar** `src/features/facturacion/domain/facturaFlags.ts`
   - Añadir `repPendiente: boolean` (requiere pagos > 0 sin REP timbrado).
   - Añadir `puedeRegistrarPago: boolean = !sinTimbrar && !estaCancelada && saldo > 0`.

4. **Editar** `src/features/facturacion/components/detalle/FacturaDetalleActionsBar.tsx`
   - Construir arrays `primary/secondary/more/destructive` según los flags.
   - Delegar en `<DetalleActionBar />`.
   - Recibir `saldoPendiente` y `onTimbrarRep` como nuevas props.

5. **Editar** `src/features/facturacion/routes/FacturaDetalle.tsx`
   - Nuevo estado `repOpen` + prop `onTimbrarRep` hacia el ActionsBar.
   - Calcular `saldo` (o subirlo desde `FacturaPagosSection` — se comparte vía `usePagosFactura` en el hijo; expondremos el mismo hook aquí).
   - Pasar callback `onRegistrarPago` que ya existía; la sección de pagos deja de renderizar su botón.

6. **Editar** `src/features/facturacion/components/detalle/FacturaPagosSection.tsx`
   - Quitar el botón `Registrar pago` del header de la card (queda sólo la lista + resumen).
   - Mantener `onRegistrarPago` en props (no rompe firma), pero no se usa desde el header.

7. **Borrar** archivos obsoletos: ninguno — reutilizamos `FacturaDetalleActionGroups.tsx` como catálogo de íconos/labels que el `ActionsBar` importa para armar cada `ActionItem`.

8. **Editar** `src/features/proformas/components/AccionesProforma.tsx`
   - Reescribir el `return` para armar los arrays y delegar en `<DetalleActionBar />`.
   - Mantener diálogos internos (`enviarOpen`, `manualOpen`).

9. **Editar** `src/features/embarques/components/TabFacturacion.tsx`
   - Insertar `<DetalleActionBar />` como primer hijo del wrapper, antes de `FlujoFacturacionStepper`.
   - Callbacks: reutilizar el mismo `setDialogOpen` / `registerRef`.

10. **Mantenimiento**
    - Bump `APP_VERSION` a `13.213.8` en `src/constants/appVersion.ts`.
    - Entrada en `CHANGELOG.md`:
      `## [13.213.8] - 2026-07-07` con bullets: barra de acciones unificada en Factura/Proforma/Tab Facturación, Registrar pago y Timbrar REP subidos al header, patrón "Más acciones" para descargas secundarias.

## Verificación

- `bun x tsgo` (typecheck) verde.
- `bunx vitest run src/components/shared/DetalleActionBar.test.tsx` verde.
- `bunx vitest run src/features/facturacion` verde (regresión de flags).
- Playwright headless: login demo → `/facturacion` → click en fila Por cobrar → `Registrar pago` visible en el top del detalle → screenshot como evidencia.

## Fuera de alcance

- CxP (`/compras/facturas`) no tiene detalle por factura hoy — no se toca.
- No se agrega ninguna acción nueva al listado/tablas (las bandejas quedan como están, sólo filas clickeables).
- No se cambian los diálogos existentes (Timbrar, Enviar, Registrar pago, Sustituir, Cancelar) — sólo cómo se disparan.
