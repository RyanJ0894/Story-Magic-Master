import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface TeamInviteEmailProps {
  inviterName: string;
  teamName: string;
  inviteUrl: string;
  recipientEmail: string;
}

export default function TeamInviteEmail({
  inviterName = 'A colleague',
  teamName = 'Production Team',
  inviteUrl = 'https://www.storymagicapp.net/invite/abc123',
  recipientEmail = 'reader@example.com',
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You&apos;ve been invited to join {teamName} on Story Magic</Preview>
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
            <Heading style={heading}>You&apos;re invited to join a team</Heading>

            <Text style={paragraph}>Hi there,</Text>

            <Text style={paragraph}>
              <strong>{inviterName}</strong> has invited you to join{' '}
              <strong>{teamName}</strong> on Story Magic.
            </Text>

            <Text style={paragraph}>
              As a team member, you&apos;ll be able to access shared scripts, listen to audio
              productions, and collaborate with the team.
            </Text>

            <Section style={buttonSection}>
              <Button style={button} href={inviteUrl}>
                Accept Invitation
              </Button>
            </Section>

            <Text style={secondaryText}>
              Or copy and paste this link into your browser:
            </Text>
            <Text style={linkText}>
              <Link href={inviteUrl} style={link}>
                {inviteUrl}
              </Link>
            </Text>

            <Hr style={hr} />

            <Text style={footerText}>
              This invitation was sent to {recipientEmail}. If you weren&apos;t expecting this
              invitation, you can safely ignore this email.
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

const secondaryText = {
  color: '#8898aa',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const linkText = {
  margin: '0 0 24px',
};

const link = {
  color: '#7c3aed',
  fontSize: '14px',
  wordBreak: 'break-all' as const,
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
