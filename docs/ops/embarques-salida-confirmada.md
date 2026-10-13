# Salida de embarques: confirmación operativa

La ETD es una estimación. Su vencimiento no cambia un embarque de Confirmado a
En Tránsito, no completa la fase de tránsito y no genera por sí solo un evento
Zarpe ni un aviso al cliente.

En el detalle de un embarque Confirmado con ETD anterior al día UTC actual se
muestra «Salida pendiente de confirmar». El operador verifica la salida con el
transportista y usa la acción de avance: el diálogo pide confirmar expresamente
que el transporte ya salió. Una ETD futura no impide confirmar una salida real
anticipada, pero conserva la advertencia y no se sobrescribe con una fecha real.

El flujo manual existente llama una sola vez a `avanzar_estado_embarque` con su
llave idempotente. Registra el evento Zarpe con el usuario, una descripción de
confirmación manual y la hora de confirmación. Esa hora no pretende reconstruir
la hora histórica real del zarpe. El aviso al cliente conserva el mecanismo
existente asociado al cambio de estado confirmado.

No se integra ningún transportista ni se inventa validación de eventos externos.
No existe en el modelo revisado un campo ATD / fecha de salida real separado.
Capturar esa fecha histórica, una fuente estructurada o una evidencia documental
requiere una ampliación posterior del contrato, no inferirlas de la ETD.

Los estados ya guardados no se corrigen por barrido. Un En Tránsito histórico no
retrocede al corregir ETD, y los estados posteriores/terminales se conservan.
Se mantiene la sincronización de Arribo de embarques En Tránsito cuando ya hay
fecha de llegada real capturada y se cumple la condición de ETA existente.

## Alcance técnico

- Calculador compartido: conserva Confirmado y no infiere salida por ETD.
- Auto-sync: sólo acepta el arribo respaldado por llegada real; no escribe zarpe.
- Fases: el tránsito depende del estado, no de que venza ETD.
- Detalle: alerta separada y confirmación explícita del operador.
- Portales/listas que usan el calculador comparten la misma regla.

Este parche frontend no requiere migración ni toca registros existentes.
Las funciones SQL de reportes que derivan estados desde ETD deben alinearse en
una migración independiente revisada; desplegar sólo frontend no demuestra esa
alineación ni cambia las funciones backend instaladas.

## Regresiones

Cubrir Confirmado con ETD/ETA vencidas, fecha llegada real sin salida confirmada,
refetch/remount y efectos repetidos, salida explícita, cancelación del diálogo,
ETD futura tras zarpe guardado, estados terminales, fases y portal del agente.
Las pruebas de hooks usan dobles de servicios: no timbran ni escriben en ERP.
