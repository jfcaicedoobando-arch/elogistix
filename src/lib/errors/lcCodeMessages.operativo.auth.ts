/**
 * Mensajes `LC_*` de autenticación, tenancy, permisos y organización.
 *
 * Consumido por `lcCodeMessages.operativo.ts`.
 */
export const LC_CODE_MESSAGES_OPERATIVO_AUTH: Record<string, string> = {
  LC_AUTH_REQUIRED: "Debes iniciar sesión para continuar.",
  LC_NO_AUTORIZADO: "No tienes permisos para realizar esta acción.",
  LC_ROL_INSUFICIENTE:
    "Necesitas un rol financiero (administrador, contador o tesorero) para esta acción.",

  LC_ROL_LEGACY_BLOQUEADO:
    "Ese rol ya no se usa. Asigna uno del catálogo actual (por ejemplo, admin_org o coordinador_logistico).",
  LC_ROL_PLATAFORMA_NO_PERMITIDO:
    "El rol de super administrador es de plataforma: no puede asignarse dentro de una organización.",
  LC_ROL_FORBIDDEN: "No tienes el rol necesario para realizar esta acción.",
  LC_FORBIDDEN_FACTURA_PROVEEDOR_DELETE:
    "No tienes permisos para eliminar facturas de proveedor.",
  LC_ORG_FORBIDDEN: "Este recurso pertenece a otra organización.",
  LC_ORG_NO_RESUELTA: "No fue posible resolver la organización activa. Vuelve a iniciar sesión.",
  LC_ORG_AJENA: "No tienes acceso a la información de esa organización.",
  LC_ORG_REQUERIDA:
    "Selecciona una organización en el menú superior para ver este reporte.",
  LC_ORG_SCOPE_PENDIENTE:
    "Selecciona una organización activa antes de continuar.",
  LC_ORG_INEXISTENTE: "La organización seleccionada ya no existe.",
  LC_PROVEEDOR_INEXISTENTE:
    "El proveedor no existe o no pertenece a tu organización.",
  LC_ORG_SIN_CONTEXTO:
    "No hay una organización activa en tu sesión. Selecciona la organización y vuelve a intentarlo.",
  LC_SIN_ORG:
    "Tu usuario no tiene una organización asignada. Contacta al administrador.",
  LC_TENANT_MISMATCH: "El recurso no pertenece a tu organización.",
  LC_ORG_FUERA_DE_SCOPE:
    "El registro pertenece a otra organización. Cambia de organización activa para poder verlo o editarlo.",
  LC_SOLO_SUPER_ADMIN:
    "Esta acción sólo la puede realizar el administrador de la plataforma.",
  LC_CUENTA_NO_REINVITABLE:
    "Ese correo ya tiene una cuenta que no es de portal de esta organización. Pide a la persona que inicie sesión con su cuenta actual o usa otro correo.",
  LC_DELETE_PROHIBIDO: "Este registro no puede eliminarse desde la aplicación.",
};
