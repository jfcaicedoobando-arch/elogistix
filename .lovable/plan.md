## Contexto

Embarques ya quedó migrado completo en el turno anterior (`13.123.0`). Los `Dialog` que quedan dentro de `src/features/embarques` (`TabCierre`) y `src/features/operaciones` (`EmbarquesEstadoDialog`) son **paneles de lectura / diálogos de avance de estado**, no formularios — quedan fuera del shell (igual que `DialogMarcarFacturada`, `DialogEliminarEmbarque`, etc.).

Los pendientes reales del plan original son **Costeo (3)** + **Cotización/CRM extras (4)**. Aprovecho para incluir también dos modales de Costeo que salieron en la auditoría pero no estaban listados: el `Dialog` inline de **CosteoNavieras** (carta-garantía / tabulador) y el de **CosteoDemorasVenta**.

## Alcance — 9 modales en 2 sub-grupos

### Sub-grupo A · Costeo (5)

| Modal | Icon sugerido | Size |
|---|---|---|
| `RutaFormDialog` | `Route` | `lg` |
| `TarifaForm` | `Tag` | `2xl` |
| `CosteoAgenteFormDialog` | `Users` | `xl` |
| `BuscarTarifaDialog` | `Search` | `2xl` |
| Dialog inline de **CosteoNavieras** (carta garantía + tabulador escalonado) | `FileSignature` | `xl` |
| Dialog inline de **CosteoDemorasVenta** | `Timer` | `lg` |

> Si el dialog inline de Costeo tiene mucha lógica acoplada a la ruta, se extrae a `src/features/costeo/components/` como componente propio antes de migrarlo (mantengo el límite Power-of-10 de ≤200 líneas).

### Sub-grupo B · Cotización / CRM extras (4)

| Modal | Icon sugerido | Size | Wizard? |
|---|---|---|---|
| `DialogConvertirProspecto` | `UserCheck` | `lg` | no |
| `EnviarCotizacionDialog` | `Send` | `xl` | no |
| `RecotizarModal` | `RefreshCw` | `2xl` | no |
| `RevalidarTarifaModal` | `ShieldCheck` | `2xl` | no |

## Reglas comunes (idénticas a Olas anteriores)

- Sólo **presentación**: nada de cambios en hooks, servicios, RLS, validaciones, atajos de teclado o controllers.
- Header con icon-tile + descripción contextual, body scrolleable, footer sticky.
- Donde haya resumen vivo (totales, badges de validación), va en `headerAside`.
- Confirmaciones cortas siguen como `AlertDialog` — no migrar.
- Sin nuevos tokens de color.

## Validación

- `tsgo` y suite de tests verde por sub-grupo antes de subir versión.
- Smoke visual en preview de 2 modales por sub-grupo: abrir → cancelar → cerrar sin errores en consola.

## Entregables por sub-grupo

1. Sub-PR A (Costeo): bump a `13.124.0` + entrada en `CHANGELOG.md`.
2. Sub-PR B (Cotización): bump a `13.125.0` + entrada en `CHANGELOG.md`.

## Después de esto queda pendiente (Ola 2 + Ola 3)

- **Presupuesto** (`DialogCategoria`), **Auth/Perfil** (`ForgotPasswordDialog`, `CambiarPasswordDialog`), **Comisiones** (`DialogGenerarLiquidacion`, `DialogRegistrarPagoLiquidacion`), **Auditoría** (`AsignarResponsableDialog`).
- **Ola 3 wizards reales**: `BulkImportDialog` (validar → mapear → confirmar) + revisar si `DialogGenerarLiquidacion` se trata como wizard.

## Pregunta

¿Arranco con **Sub-grupo A (Costeo, 5 modales)** primero y dejo Cotización para el siguiente turno, o **los 9 en un solo turno**?
