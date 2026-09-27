# Backups y rollback — referencia rápida

Revisado el **2026-09-26**. Ver [runbook](operations.md).
No se certifican retención/RPO/RTO en esta documentación.

## Antes de actuar

Confirmar entorno, autorización, respaldo restaurable y permisos.
Preservar estado actual y acordar ventana sin escrituras.
Distinguir base, Storage, Auth, secretos, funciones y código.
Probar restauración en entorno aislado.

| Situación | Alternativa |
| --- | --- |
| Bug frontend | Hotfix/rollback y publicación, sin restore de datos |
| Función/migración incorrecta | Deploy correctivo / migración nueva |
| Error puntual | Reparación acotada autorizada después de diagnosticar |
| Pérdida amplia | Restore del proveedor validado fuera de Live |

No borrar migraciones, reescribir Git, ejecutar seeds o desactivar
organizaciones para improvisar mantenimiento.

## Validación posterior

Schema/relaciones, login/roles, pantallas, archivos Storage y backend.
Reconciliar timbrados/cancelaciones FacturAPI y movimientos bancarios
posteriores al backup. Restore local no deshace un CFDI ni una transferencia.
No reemitir/reaplicar sin reconciliar.

Un simulacro requiere entorno aislado, autorización y evidencia: fecha,
respaldo, duración, punto recuperado, alcance y responsable.
No declarar simulacro aprobado mientras esa evidencia no exista.
