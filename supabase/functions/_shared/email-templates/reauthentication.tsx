/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { brand, code, container, footer, h1, main, text } from './styles.ts'

interface ReauthenticationEmailProps {
  siteName: string
  siteUrl: string
  token: string
}

export const ReauthenticationEmail = ({
  siteName,
  token,
}: ReauthenticationEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Tu código de verificación de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Tu código de verificación</Heading>
        <Text style={text}>
          Captura este código en <strong>{siteName}</strong> para confirmar la
          operación:
        </Text>
        <Text style={code}>{token}</Text>
        <Text style={footer}>
          El código vence en unos minutos. Si no lo solicitaste, ignora este
          correo y cambia tu contraseña.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
