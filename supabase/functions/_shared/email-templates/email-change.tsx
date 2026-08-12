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

interface EmailChangeEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  email?: string
  newEmail?: string
}

export const EmailChangeEmail = ({
  siteName,
  confirmationUrl,
  email,
  newEmail,
}: EmailChangeEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Confirma tu nuevo correo en {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirma tu nuevo correo</Heading>
        <Text style={text}>
          Pediste cambiar el correo de tu cuenta en <strong>{siteName}</strong>
          {email && newEmail ? (
            <>
              {' '}
              de <strong>{email}</strong> a <strong>{newEmail}</strong>
            </>
          ) : null}
          . Confirma el cambio para que puedas seguir entrando.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar el cambio
        </Button>
        <Text style={footer}>
          Si no pediste este cambio, ignora este correo y avisa a tu
          administrador.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
