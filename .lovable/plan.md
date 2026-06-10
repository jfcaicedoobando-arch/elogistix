## Problema

En el paso 3 (Costos y Pricing) de **Editar Embarque**, al hacer clic en **"+ Agregar costo"** (o "+ Agregar concepto" de venta), la fila se agrega y desaparece de inmediato, dando la impresión de que la app "no permite" agregar.

## Causa raíz

`src/features/embarques/hooks/useHidratacionEditarEmbarque.ts` tiene dos `useEffect` que hidratan `conceptosVenta` / `conceptosCosto` desde la BD pero:

1. No usan un flag de "ya hidraté" (a diferencia de los efectos de contactos y contenedores que sí lo tienen).
2. Incluyen el objeto `p` completo en sus dependencias — `p` se reconstruye en cada render del componente padre.

Resultado: cada render del wizard vuelve a ejecutar `inicializarCosto(...)` con los datos originales de la BD, sobrescribiendo el estado local y borrando la fila recién agregada.

## Cambios

### 1. `src/features/embarques/hooks/useHidratacionEditarEmbarque.ts`
- Agregar parámetros `hidratoVenta`, `hidratoCosto`, `setHidratoVenta`, `setHidratoCosto` (mismo patrón que `hidratoContactos`).
- En el efecto de venta: salir si `hidratoVenta` ya es `true`; al terminar, llamar `setHidratoVenta(true)`. Reemplazar dep `p` por las dependencias reales (`p.initialized`, `p.conceptosVentaDb`, `p.hidratoVenta`, `p.inicializarVenta`).
- Mismo cambio para el efecto de costo.
- Aplicar la misma limpieza de dependencias (`p` → deps específicas) en los efectos de contactos y contenedores para consistencia.

### 2. `src/features/embarques/hooks/useEditarEmbarqueWizard.ts`
- Agregar `const [hidratoVenta, setHidratoVenta] = useState(false)` y `hidratoCosto` equivalente.
- Pasarlos al hook `useHidratacionEditarEmbarque`.

### 3. `src/constants/appVersion.ts` + `CHANGELOG.md`
- Bump patch a `12.76.31`.
- Entrada: "Fix: al editar embarque, agregar costo/venta ya no desaparece (hidratación se ejecuta una sola vez)."

## Validación

- Abrir `/embarques/:id/editar`, ir al paso 3, dar clic en "+ Agregar costo" y "+ Agregar concepto" varias veces — las filas deben persistir.
- Verificar que los conceptos originales de la BD siguen cargándose correctamente al entrar.
- Verificar que editar campos existentes (proveedor, monto, etc.) no se revierte.
- Confirmar que el test `useEditarEmbarqueWizard.test.tsx` sigue pasando.
