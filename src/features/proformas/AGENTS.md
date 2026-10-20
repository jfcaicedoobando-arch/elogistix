# Decisiones técnicas Proformas
- Proformas canceladas son terminales para envío, respuesta, consolidación y facturación; las consultas del histórico siguen disponibles. Los guards de RPC y triggers conservan tenant/roles/ACL y permiten refacturar mediante una nueva proforma. Why: liberar conceptos no permite reactivar el documento histórico.
- Proformas: `eliminar_proforma_rpc` ya no borra; marca `estado_proforma='cancelada'`, libera `conceptos_venta` a pendiente y `recompute_embarque_tiene_proforma` ignora canceladas/borradas. Why: conservar el histórico al refacturar tras cancelar el CFDI.
