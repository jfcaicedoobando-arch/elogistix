/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@19.2.8'

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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Confirma tu nuevo correo en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirma tu nuevo correo</Heading>
        <Text style={text}>
          Recibimos una solicitud para cambiar el correo de tu cuenta en {siteName} de{' '}
          <strong>{oldEmail || email}</strong> a <strong>{newEmail || email}</strong>.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar cambio
        </Button>
        <Text style={footer}>
          Si no solicitaste este cambio, puedes ignorar este mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
