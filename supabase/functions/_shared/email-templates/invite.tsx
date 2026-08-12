/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { brand, button, container, footer, h1, link, main, text } from './styles.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Te invitaron a {siteName}: activa tu cuenta</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Te invitaron a {siteName}</Heading>
        <Text style={text}>
          Un administrador de{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>{' '}
          te dio acceso a la plataforma. Da clic en el botón para activar tu
          cuenta y crear tu contraseña.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Activar mi cuenta
        </Button>
        <Text style={footer}>
          Esta invitación es personal y vence en unos días. Si no la esperabas,
          puedes ignorar este correo.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
