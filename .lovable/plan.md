# Validación en vivo del cuadre conceptos ↔ subtotal (CxP)

## Problema

Hoy el error `LC_CXP_DESCUADRE` sólo aparece al **aprobar** la factura, cuando el usuario ya cerró el editor de conceptos y cambió de contexto. La regla de negocio existe en el trigger de BD (`aprobar_factura_proveedor`), pero la UI no la refleja mientras se captura.

Meta: que el usuario **vea el descuadre en tiempo real** dentro del editor de conceptos y no pueda guardar/aprobar hasta que la suma neta cuadre con el subtotal de la factura.

## Alcance

Solo UI del editor de conceptos de CxP. No se toca el trigger de BD ni el flujo de aprobación (siguen siendo la última línea de defensa).

Archivos objetivo (a confirmar al pasar a build):
- `src/features/cxp/components/DialogDetallePagosProveedor.parts.tsx` (sección "Conceptos / Desglose contable")
- El componente que renderiza el editor de renglones dentro del detalle (típicamente `ConceptosEditor*` en `src/features/cxp/components/`)
- Reutiliza `Kpi` / chip existentes del rediseño reciente para consistencia visual

## Diseño funcional

1. **Barra de cuadre sticky** arriba de la tabla de conceptos con 3 valores:
   - Subtotal factura (fuente de verdad, read-only)
   - Suma de conceptos (live)
   - Diferencia = Subtotal − Suma
2. **Estados visuales** de la barra:
   - Verde ✅ "Cuadrado" cuando `|diferencia| ≤ 0.01`
   - Ámbar ⚠️ "Faltan $X.XX" cuando la suma es menor
   - Rojo ⛔ "Sobran $X.XX" cuando la suma es mayor
3. **Bloqueo de guardado**:
   - Botón "Guardar conceptos" deshabilitado mientras no cuadre, con tooltip explicando la diferencia exacta.
   - Al pasar el mouse, muestra los dos valores para que el usuario sepa hacia dónde ajustar.
4. **Ayuda contextual** (una línea muted):
   - "¿Descuento del proveedor? Agrega un renglón con importe negativo por la diferencia."
5. **Soporte de importes negativos**:
   - Permitir `-` en el input numérico de importe (ya usa `NumericInput`; confirmar que acepta negativos, si no, agregar prop `allowNegative`).
   - IVA del renglón negativo por defecto 0, editable.
6. **Precisión**:
   - Comparación con tolerancia `0.01` usando `currency.js` (ya es estándar del proyecto según `financialUtils.ts`).
   - Redondeo a 2 decimales sólo para display; los cálculos internos usan la lib.

## Fuera de alcance

- No se toca el flujo XML (ya trae el cuadre garantizado por SAT).
- No se modifica el trigger de BD ni el mensaje `LC_CXP_DESCUADRE` (siguen protegiendo si el usuario burla la UI).
- No se agregan tests E2E; sí un test unitario del helper de cuadre.

## Detalles técnicos

- **Helper puro**: `calcularCuadreConceptos(subtotal, conceptos)` → `{ suma, diferencia, estado: 'cuadrado'|'faltante'|'sobrante' }` en un archivo nuevo bajo `src/features/cxp/utils/`. Test unitario con fixture del caso real (19,150 + −510.40 vs 18,639.60).
- **Hook**: `useCuadreConceptos(subtotal, conceptos)` que memoiza el cálculo y devuelve además `puedeGuardar: boolean`.
- **Componente**: `<CuadreConceptosBar />` reutilizando `Kpi` con variante `emphasis` cuando está en rojo/ámbar.
- **CHANGELOG + APP_VERSION** bump patch (`13.303.96`).
- **Reglas del proyecto respetadas**: archivo ≤ 200 líneas, sin `any`, sin colores hardcodeados (usa tokens `--destructive`, `--warning`, `--success` ya existentes), `useEffect` no aplica (todo derivado).

## Criterio de aceptación

- Al abrir el editor de conceptos con la factura del ejemplo (FP-000039), la barra muestra ⚠️ "Faltan $-510.40" en rojo/ámbar y el botón Guardar está deshabilitado.
- Al agregar un renglón por `-510.40`, la barra pasa a ✅ verde y Guardar se habilita.
- Si el usuario intenta poner `-600`, la barra pasa a "Sobran $89.60" y bloquea de nuevo.
- Aprobar la factura después de guardar cuadrado ya no dispara `LC_CXP_DESCUADRE`.
