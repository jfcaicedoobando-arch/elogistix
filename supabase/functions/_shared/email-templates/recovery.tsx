/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { brand, button, container, footer, h1, main, text } from './styles.ts'

interface RecoveryEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Restablece tu contraseña</Heading>
        <Text style={text}>
          Recibimos una solicitud para cambiar la contraseña de tu cuenta en{' '}
          <strong>{siteName}</strong>. Da clic en el botón para crear una nueva.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Crear nueva contraseña
        </Button>
        <Text style={footer}>
          El enlace vence en una hora. Si no pediste el cambio, ignora este
          correo: tu contraseña actual sigue funcionando.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
