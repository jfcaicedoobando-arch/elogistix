
# Matching automático de conciliación factura ↔ conceptos_costo

## Contexto

Hoy en el diálogo "Capturar factura de proveedor" ya existe `VincularEmbarqueSection`: el usuario ve manualmente los conceptos_costo pendientes del proveedor y marca cuáles cubre la factura. El servicio `vincularFacturaAConceptos` liquida los que quedan ≥99% cubiertos.

**Lo que falta**: el sistema no *sugiere* nada. Con facturas de 15+ conceptos, el usuario debe cruzar a ojo la descripción de cada línea de la factura con cada concepto pendiente. Es tedioso y propenso a error.

## Qué se construye

Un motor de **matching por similitud + monto** que:

1. Compara cada línea capturada de la factura contra los `conceptos_costo` abiertos del mismo proveedor.
2. Calcula un score `0..1` combinando:
   - **Similitud de descripción** (normalizada: sin acentos, minúsculas, sin stopwords "servicio/flete/cargo/de/del/la"). Bigrama de Dice.
   - **Cercanía de monto** (misma moneda; tolerancia ±5% = 1.0, ±20% = 0.5, >20% = 0).
   - **Bonus** si el concepto ya está anclado al embarque_id sugerido por otro match del mismo lote.
3. Recomienda automáticamente los pares con score ≥ 0.75 (confianza alta) y muestra sugerencias con score 0.5–0.75 como "revisar".

## Cambios UI

### A. En captura de factura (diálogo existente)

Nuevo botón **"Sugerir vinculación automática"** dentro de `VincularEmbarqueSection`, visible cuando hay ≥ 1 línea capturada Y ≥ 1 concepto pendiente:

- Al presionarlo, corre el matcher y pre-selecciona las coincidencias con score ≥ 0.75, ajustando el monto al del concepto original.
- Muestra un resumen breve: `"3 sugerencias aplicadas · 2 dudosas · 1 sin match"`.
- Un `Popover` "Ver detalle" lista línea-por-línea: emoji del score, descripción factura → descripción concepto, monto, score, botón "Aceptar"/"Rechazar" para las dudosas.

### B. En detalle de factura ya capturada (`/compras/facturas/:id`)

Cuando la factura está capturada pero sin vínculos (`proveedor_facturas_conceptos` vacío) y hay conceptos_costo pendientes del proveedor:

- Banner "Esta factura no está conciliada con ningún embarque. **Sugerir vinculación**".
- Reusa el mismo motor y modal.

## Estructura de archivos

```text
src/features/compras/matching/
├── normalizarTexto.ts         # normaliza descripciones (acentos, stopwords)
├── similitud.ts               # dice bigram + score compuesto
├── matcher.ts                 # sugerirVinculos(lineasFactura, conceptosAbiertos) → Sugerencia[]
└── __tests__/
    ├── normalizarTexto.test.ts
    ├── similitud.test.ts
    └── matcher.test.ts        # ≥ 8 casos: match exacto, sinónimos, monedas distintas, empates, sin match
```

Componentes:

```text
src/features/cxp/components/
├── VincularEmbarqueSection.tsx        # + botón "Sugerir" y estado de sugerencias
├── SugerenciasVinculoDialog.tsx       # NUEVO: revisar/aceptar dudosas
└── BannerConciliacionSugerida.tsx     # NUEVO: banner en detalle de factura
```

Hook:

```text
src/features/cxp/hooks/useSugerenciasVinculo.ts
```

## Modelo de datos

**No** requiere migración. Todo se calcula en cliente sobre datos que ya trae `fetchConceptosCostoAbiertosDeProveedor` + las líneas del formulario / de `conceptos_factura`.

## Scoring (referencia técnica)

```text
score(linea, concepto) =
  0.6 * similitudDescripcion(linea.desc, concepto.concepto)
+ 0.4 * cercaniaMonto(linea.monto, concepto.monto, moneda)
- 0.5  si moneda_linea ≠ moneda_concepto   (penalización dura)
```

`similitudDescripcion` usa coeficiente de Sørensen–Dice sobre bigramas de caracteres, tras normalizar (lowercase, sin diacríticos, quitar tokens genéricos).

`cercaniaMonto(a, b) = max(0, 1 - |a-b|/max(a,b) * 4)` → ±5% ≈ 0.8, ±25% ≈ 0.

Un concepto sólo puede vincularse a UNA línea (asignación greedy por score descendente).

## Tests

- Unitarios del matcher (fixtures con casos reales: "Flete marítimo Shanghái–Manzanillo" ↔ "flete maritimo mzo").
- Component test de `VincularEmbarqueSection` verificando que "Sugerir" pre-marca las sugerencias fuertes.
- Guardrail: `no-raw-table.test.ts` sigue verde (no toca Supabase directo desde componentes).

## Entregables por ola

**Única ola (v13.180.0)**:
1. Motor + tests.
2. Botón "Sugerir" en el diálogo de captura.
3. `SugerenciasVinculoDialog` para revisar dudosas.
4. Banner en detalle de factura.
5. Bump `APP_VERSION` + entrada en `CHANGELOG.md`.

No toca base de datos, no toca RLS, no toca edge functions.
