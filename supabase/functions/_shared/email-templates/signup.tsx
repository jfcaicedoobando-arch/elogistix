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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="es-MX" dir="ltr">
    <Head />
    <Preview>Confirma tu correo para entrar a {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>{siteName}</Text>
        <Heading style={h1}>Confirma tu correo</Heading>
        <Text style={text}>
          Ya casi terminas. Confirma tu correo para empezar a usar{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirmar mi correo
        </Button>
        <Text style={footer}>
          Si no creaste esta cuenta, puedes ignorar este correo.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
