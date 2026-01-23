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

interface ScriptStatusChangeEmailProps {
  ownerName: string;
  readerName: string;
  scriptName: string;
  status: 'like' | 'pass' | 'undecided';
  projectUrl: string;
}

export default function ScriptStatusChangeEmail({
  ownerName = 'Writer',
  readerName = 'A reader',
  scriptName = 'Untitled Script',
  status = 'like',
  projectUrl = 'https://www.storymagicapp.net/projects/abc123',
}: ScriptStatusChangeEmailProps) {
  const statusConfig = {
    like: {
      emoji: '💚',
      label: 'liked',
      color: '#22c55e',
      message: 'Great news! Your script is getting positive feedback.',
    },
    pass: {
      emoji: '🔴',
      label: 'passed on',
      color: '#ef4444',
      message: 'Your script received feedback. Keep refining your story!',
    },
    undecided: {
      emoji: '🟡',
      label: 'marked as undecided on',
      color: '#eab308',
      message: 'The reader needs more time to decide on your script.',
    },
  };

  const config = statusConfig[status];

  return (
    <Html>
      <Head />
      <Preview>
        {readerName} {config.label} your script "{scriptName}"
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

          {/* Status Badge */}
          <Section style={statusSection}>
            <div
              style={{
                ...statusBadge,
                backgroundColor: config.color + '15',
                borderColor: config.color,
              }}
            >
              <span style={statusEmoji}>{config.emoji}</span>
              <span style={{ ...statusLabel, color: config.color }}>
                {status.toUpperCase()}
              </span>
            </div>
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={heading}>Script Feedback Update</Heading>

            <Text style={paragraph}>Hi {ownerName},</Text>

            <Text style={paragraph}>
              <strong>{readerName}</strong> has {config.label} your script{' '}
              <strong>"{scriptName}"</strong>.
            </Text>

            <Text style={paragraph}>{config.message}</Text>

            <Section style={buttonSection}>
              <Button style={button} href={projectUrl}>
                View Script Details
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footerText}>
              You&apos;re receiving this because you have email notifications enabled for script
              status changes. You can update your preferences in your account settings.
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
  padding: '32px 40px 16px',
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

const statusSection = {
  padding: '0 40px 24px',
  textAlign: 'center' as const,
};

const statusBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '8px',
  padding: '12px 24px',
  borderRadius: '100px',
  border: '2px solid',
};

const statusEmoji = {
  fontSize: '20px',
};

const statusLabel = {
  fontSize: '14px',
  fontWeight: '700',
  letterSpacing: '0.5px',
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
