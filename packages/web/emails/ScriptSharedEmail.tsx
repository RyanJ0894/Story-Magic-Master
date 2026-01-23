import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ScriptSharedEmailProps {
  senderName: string;
  recipientName: string;
  scriptName: string;
  message?: string;
  shareUrl: string;
  accessLevel: 'stream' | 'download';
}

export default function ScriptSharedEmail({
  senderName = 'A writer',
  recipientName = 'Reader',
  scriptName = 'Untitled Script',
  message,
  shareUrl = 'https://www.storymagicapp.net/share/abc123',
  accessLevel = 'stream',
}: ScriptSharedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {senderName} shared "{scriptName}" with you on Story Magic
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo */}
          <Section style={logoSection}>
            <div style={logoContainer}>
              <span style={logoIcon}>✨</span>
              <span style={logoText}>Story Magic</span>
            </div>
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={heading}>A script has been shared with you</Heading>

            <Text style={paragraph}>Hi {recipientName},</Text>

            <Text style={paragraph}>
              <strong>{senderName}</strong> has shared the script{' '}
              <strong>"{scriptName}"</strong> with you on Story Magic.
            </Text>

            {message && (
              <Section style={messageBox}>
                <Text style={messageLabel}>Message from {senderName}:</Text>
                <Text style={messageText}>"{message}"</Text>
              </Section>
            )}

            <Text style={paragraph}>
              You have <strong>{accessLevel === 'download' ? 'download' : 'streaming'}</strong>{' '}
              access to this script.
              {accessLevel === 'download'
                ? ' You can listen and download the audio production.'
                : ' You can listen to the audio production online.'}
            </Text>

            <Section style={buttonSection}>
              <Button style={button} href={shareUrl}>
                Listen to Script
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footerText}>
              Don&apos;t have a Story Magic account yet?{' '}
              <Link href="https://www.storymagicapp.net/signup" style={inlineLink}>
                Sign up for free
              </Link>{' '}
              to build your library of scripts.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerLinks}>
              <Link href="https://www.storymagicapp.net" style={footerLink}>
                www.StoryMagicApp.net
              </Link>
              {' · '}
              <Link href="https://www.storymagicapp.net/guide" style={footerLink}>
                Help Center
              </Link>
            </Text>
            <Text style={copyright}>© 2026 Story Magic. All rights reserved.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0',
  marginBottom: '64px',
  maxWidth: '600px',
};

const logoSection = {
  padding: '32px 40px 24px',
};

const logoContainer = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const logoIcon = {
  fontSize: '24px',
};

const logoText = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#1a1a1a',
};

const contentSection = {
  padding: '0 40px',
};

const heading = {
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 24px',
};

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const messageBox = {
  backgroundColor: '#f8fafc',
  borderLeft: '4px solid #7c3aed',
  padding: '16px 20px',
  margin: '24px 0',
  borderRadius: '0 8px 8px 0',
};

const messageLabel = {
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const messageText = {
  color: '#334155',
  fontSize: '15px',
  fontStyle: 'italic',
  lineHeight: '1.6',
  margin: '0',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
};

const hr = {
  borderColor: '#e6ebf1',
  margin: '24px 0',
};

const footerText = {
  color: '#8898aa',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0',
};

const inlineLink = {
  color: '#7c3aed',
  textDecoration: 'underline',
};

const footer = {
  padding: '24px 40px',
  textAlign: 'center' as const,
};

const footerLinks = {
  color: '#8898aa',
  fontSize: '13px',
  margin: '0 0 8px',
};

const footerLink = {
  color: '#7c3aed',
  textDecoration: 'none',
};

const copyright = {
  color: '#8898aa',
  fontSize: '12px',
  margin: '0',
};
