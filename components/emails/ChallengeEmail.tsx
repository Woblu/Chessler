import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
} from '@react-email/components'
import * as React from 'react'

interface ChallengeEmailProps {
  challengerName: string
  gameId: string
}

export default function ChallengeEmail({
  challengerName,
  gameId,
}: ChallengeEmailProps) {
  const gameUrl = `https://mychessapp.com/play/${gameId}`

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Text style={title}>♔ Chess Challenge! ♔</Text>
            <Text style={text}>
              You have been challenged to a chess match by{' '}
              <strong>{challengerName}</strong>!
            </Text>
            <Text style={text}>
              Ready to test your skills? Click the button below to accept the
              challenge and start the game.
            </Text>
            <Section style={buttonContainer}>
              <Button style={button} href={gameUrl}>
                Accept Challenge
              </Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              This challenge was sent from Rookly. Good luck!
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#0f172a',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#1e293b',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  borderRadius: '8px',
}

const section = {
  padding: '0 48px',
}

const title = {
  fontSize: '32px',
  lineHeight: '1.3',
  fontWeight: '700',
  color: '#fbbf24',
  textAlign: 'center' as const,
  margin: '32px 0',
}

const text = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#e2e8f0',
  margin: '16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#fbbf24',
  borderRadius: '8px',
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
}

const hr = {
  borderColor: '#334155',
  margin: '32px 0',
}

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '24px',
  textAlign: 'center' as const,
  margin: '16px 0',
}
