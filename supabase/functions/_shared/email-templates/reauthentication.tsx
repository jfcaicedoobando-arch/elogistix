/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@19.2.8'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

import { code, container, footer, h1, main, text } from './styles.ts'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Tu código de verificación</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tu código de verificación</Heading>
        <Text style={text}>Ingresa este código para confirmar tu identidad:</Text>
        <Text style={code}>{token}</Text>
        <Text style={footer}>
          Si no solicitaste este código, puedes ignorar este mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
