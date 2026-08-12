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

interface MagicLinkEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Tu enlace de acceso a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Entra sin contraseña</Heading>
        <Text style={text}>
          Usa este enlace para entrar a <strong>{siteName}</strong>. Es de un
          solo uso y vence pronto.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Entrar a la plataforma
        </Button>
        <Text style={footer}>
          Si no solicitaste este acceso, ignora este correo.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
