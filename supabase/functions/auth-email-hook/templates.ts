/**
 * Catálogo de plantillas y configuración de remitente para los correos de
 * autenticación. Separado de `index.ts` para respetar el límite de líneas.
 */
import type * as React from 'npm:react@18.3.1'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

/** Props que reciben las plantillas (todas opcionales según el tipo de correo). */
export type EmailTemplateProps = Record<string, unknown>

export const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirma tu correo',
  invite: 'Te invitaron a Libre Carga',
  magiclink: 'Tu enlace de acceso',
  recovery: 'Restablece tu contraseña',
  email_change: 'Confirma tu nuevo correo',
  reauthentication: 'Tu código de verificación',
}

export const EMAIL_TEMPLATES: Record<string, React.ComponentType<EmailTemplateProps>> = {
  signup: SignupEmail as React.ComponentType<EmailTemplateProps>,
  invite: InviteEmail as React.ComponentType<EmailTemplateProps>,
  magiclink: MagicLinkEmail as React.ComponentType<EmailTemplateProps>,
  recovery: RecoveryEmail as React.ComponentType<EmailTemplateProps>,
  email_change: EmailChangeEmail as React.ComponentType<EmailTemplateProps>,
  reauthentication: ReauthenticationEmail as React.ComponentType<EmailTemplateProps>,
}

export const SITE_NAME = 'Libre Carga'
export const SENDER_DOMAIN = 'notify.librecarga.com'
export const ROOT_DOMAIN = 'librecarga.com'
/** Dominio mostrado en el From (puede ser el raíz o el subdominio de envío). */
export const FROM_DOMAIN = 'librecarga.com'
