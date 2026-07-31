# Nuevo estado de embarque: "Por liquidar"

## Por qué

Hoy el flujo termina en `EIR → Cerrado`, y el cierre exige que ya se haya **cobrado al cliente** y **pagado al proveedor**. Resultado: el operador termina todo su trabajo (entrega, EIR, documentos, contenedores) y el embarque se queda semanas en EIR, mezclado con los que sí tienen pendientes operativos.

Con **Por liquidar** separamos dos cierres distintos:

```text
... → Entregado → EIR → Por liquidar → Cerrado
                        ^^^^^^^^^^^^
              cierre operativo listo;   cierre financiero
              falta cobrar y/o pagar    completo
```

Analogía: EIR es "ya entregué el pedido y recogí el envase"; Por liquidar es "ya no me toca nada, solo falta que la caja cobre y pague"; Cerrado es "expediente archivado".

## Comportamiento acordado

- **Entrar a Por liquidar**: manual (el operador presiona "Avanzar estado") y también automático cuando se cumple todo lo operativo (documentos requeridos, contenedores con fechas, EIR registrado). Lo que ocurra primero.
- **Salir a Cerrado**: automático cuando se liquida el último cobro y el último pago, con aviso al usuario. Sigue siendo reversible con el flujo actual de reabrir embarque (con motivo).
- El nuevo estado **no** es un estado activo operativo: no debe aparecer en las cargas de trabajo del operador, pero sí en los tableros de cobranza y tesorería.

## Qué se construye

### Base de datos
1. Agregar `'Por liquidar'` al enum `estado_embarque`.
2. Actualizar la máquina de estados `transicion_embarque_valida`:
   - `EIR → 'Por liquidar' | 'Cerrado' | 'Entregado'` (se conserva el salto directo a Cerrado para embarques que ya están liquidados).
   - `'Por liquidar' → 'Cerrado' | 'EIR'` (regreso por corrección).
   - `Cerrado → 'Por liquidar'` al reabrir (hoy regresa a EIR; reabrir por tema financiero debe caer en Por liquidar).
3. `avanzar_estado_embarque`: al pasar a `Por liquidar` sólo validar lo **operativo** (documentos, contenedores/fechas). El checklist financiero completo (`validar_cierre_embarque`) se sigue exigiendo únicamente para `Cerrado`.
4. Auto-avance a `Por liquidar` mediante trigger cuando se cumple lo operativo desde EIR.
5. Auto-cierre: cuando el último saldo de CxC y CxP queda en cero y el embarque está en `Por liquidar`, cerrar automáticamente vía la lógica existente de cierre (registrando en `cierre_embarque_log` que fue automático, para trazabilidad).

### Frontend
- `embarqueConstants.ts`: insertar `'Por liquidar'` en `ESTADOS_EMBARQUE` entre `EIR` y `Cerrado`. Se mantiene fuera de `ESTADOS_ACTIVOS`.
- `statusRegistry.ts`: color/badge propio (ámbar administrativo, distinto del verde de Cerrado y del azul operativo) con tooltip "Operación terminada; pendiente de cobrar y/o pagar".
- `useEmbarqueEstadoActions`: el botón "Avanzar estado" desde EIR ofrece Por liquidar; desde Por liquidar ofrece Cerrado con el candado financiero actual.
- Tab de Cierre: el checklist ya está separado por fases; se etiqueta visualmente qué fases desbloquean **Por liquidar** (operativas) y cuáles **Cerrado** (cobranza/tesorería).
- Filtros de embarques, KPIs de dashboard y portal de cliente: incluir el nuevo estado en conteos; en el portal se presenta al cliente como "Finalizado" para no exponer detalle interno de cobranza.
- Timeline de fases (`calcularFasesEmbarque` / `FasesEmbarqueStepper`): agregar la fase con su icono, manteniendo las variantes compacta y completa.

### Pruebas
- Test del grafo de transiciones (extender `grafo-transiciones-embarque-fase-g.test.ts`) con las nuevas aristas y las prohibidas (por ejemplo `Entregado → Por liquidar` no permitido).
- Test RLS/SQL: avanzar a `Por liquidar` con CxC pendiente debe **pasar**; avanzar a `Cerrado` en las mismas condiciones debe **fallar**.
- Tests de UI: badge, opción del botón "Avanzar estado" y conteos de filtros.
- Test del auto-cierre al liquidar el último pago.

### Datos existentes
Los embarques que hoy están en EIR con operación terminada pero con saldos pendientes se migran de una sola vez a `Por liquidar`, para que el tablero refleje la realidad desde el primer día.

## Notas técnicas

- El enum se amplía con `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'Por liquidar' BEFORE 'Cerrado'`; ningún valor existente se elimina, así que los históricos no se tocan.
- El auto-cierre reutiliza `cerrar_embarque` y `validar_cierre_embarque`: no se duplica lógica de validación.
- Se registra en `CHANGELOG.md` y se sube `APP_VERSION` (minor: nuevo estado de negocio).
