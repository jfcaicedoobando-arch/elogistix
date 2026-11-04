# Auditoría de Comisiones: bugs y flujo

## Diagnóstico confirmado (datos reales)

Caso: **ELIMP00437** (Entregado, factura Pagada). Hoy, 04/11 a las 20:23, se le asignó una vendedora.
- La comisión de ese embarque se creó el **03/11**, cuando se registró el pago. En ese momento el embarque **no tenía vendedora**, así que quedó guardada **sin vendedora y en $0.00**.
- Asignar la vendedora sólo cambia el embarque. **No recalcula la comisión que ya existía.**
- Resultado: el embarque sale de «Embarques sin vendedora» (eso es normal). Pero tampoco aparece con la vendedora en «Devengadas», porque la comisión sigue diciendo «sin vendedora, $0».

Es como poner el nombre en el sobre después de cerrar la nómina: el sobre ya salió en blanco y nadie lo vuelve a llenar.

Otros datos: 133 comisiones, **132 sin vendedora**. Sólo **1 vendedora configurada**. Hay 22 pendientes de recálculo atoradas desde el 23/10 («la factura no tiene embarque ligado»). El otro embarque asignado (ELIMP00447) aún no tiene factura, así que lo normal es que no tenga comisión.

## Hallazgos (por prioridad)

**Críticos (dinero mal atribuido)**
1. Asignar o cambiar la vendedora no recalcula las comisiones del embarque que ya existen.
2. Cuando una comisión cancelada se recalcula, el monto se actualiza pero el estado sigue en «Cancelada».
3. Si el recálculo da «sin vendedora» o «varias vendedoras», la comisión conserva la vendedora anterior en lugar de limpiarla.
4. Los embarques creados desde una cotización no heredan el campo «Comercial». Por eso casi todos nacen sin vendedora.

**Flujo / fricción**
5. No hay una lista de «embarques asignados»: al asignar uno, desaparece de la pantalla sin confirmación visible.
6. Las pendientes de recálculo que dan $0 nunca se cierran. Las 22 atoradas necesitan revisión, no reintentos.
7. Si la consulta falla, el panel muestra «Todos los embarques tienen vendedora asignada». Debería mostrar el error.
8. Liquidaciones no muestra estado de error.
9. El filtro de mes usa la fecha en que se creó la comisión, no la del pago, y no lo explica.
10. El indicador «Por recuperar» suma el total aunque ya se haya recuperado una parte.

**Bajo / vigilar**
11. Las comisiones guardadas en memoria del navegador no distinguen la organización. Puede verse un dato viejo un momento al cambiar de empresa.
12. En pagos parciales puede haber diferencias de centavos por redondeo (sólo lo documento, no lo cambio).

## Plan de corrección (mínimo, sin features nuevas)

1. **Recalcular al asignar:** al asignar o cambiar la vendedora, volver a calcular las comisiones de los pagos de ese embarque en la misma operación. Si ya hay una comisión liquidada, se rechaza con un mensaje claro.
2. **Corregir el recálculo:** restaurar el estado «Devengada» cuando corresponda y limpiar la vendedora en los casos «sin vendedora» o «varias vendedoras».
3. **Heredar «Comercial»:** al crear un embarque desde una cotización, copiar la vendedora de la cotización (sólo si es una vendedora válida de la misma organización).
4. **Reparar ELIMP00437:** recalcular su comisión ya con la vendedora asignada y confirmar que aparece en Devengadas.
5. **Pantalla:** avisar «Asignado a X» al asignar, mostrar los errores reales en ambos paneles y aclarar que el filtro de mes usa la fecha de la comisión.
6. **Indicador «Por recuperar»:** restar lo que ya se recuperó.
7. **Las 22 pendientes:** sólo un reporte de lectura para decidir caso por caso. No las toco automáticamente.

## Detalles técnicos

- Los pasos 1–3 requieren una **migración SQL** en `calcular_comision_pago`, una RPC `asignar_vendedora_embarque` con candado y verificación de rol, y `crear_embarque_borrador_core`. Necesito tu autorización explícita, por la regla de «no crear migraciones salvo instrucción». Se cierra con `db:postcheck` y una baseline nueva.
- Sin la migración, sólo puedo hacer los pasos 5 y 6 y el reporte del paso 7. El bug principal seguiría.
- Frontend: `services/vendedoras.ts`, `TabVendedorasConfig.tsx`, `TabLiquidaciones.tsx`, `services/devengadas.ts` y las claves de memoria con la organización (`queryKeys.ts`).
- Pruebas focalizadas: reasignar recalcula, cancelada→devengada, limpiar vendedora, herencia desde cotización, indicador «Por recuperar». El CI completo y las pruebas RLS quedan para GitHub Actions. Sin cambiar versión ni changelog.
