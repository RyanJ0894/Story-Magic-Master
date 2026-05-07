import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface CommentNotificationEmailProps {
  ownerName: string;
  commenterName: string;
  projectName: string;
  commentBody: string;
  projectUrl: string;
}

export default function CommentNotificationEmail({
  ownerName = 'Creator',
  commenterName = 'A collaborator',
  projectName = 'My Project',
  commentBody = '',
  projectUrl = 'https://www.storymagicapp.net',
}: CommentNotificationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {commenterName} commented on &ldquo;{projectName}&rdquo;
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <span style={logoIcon}>✨</span>
            <span style={logoText}>Story Magic</span>
          </Section>

          <Section style={contentSection}>
            <Heading style={heading}>New comment on your project</Heading>

            <Text style={paragraph}>Hi {ownerName},</Text>

            <Text style={paragraph}>
              <strong>{commenterName}</strong> left a comment on your project{' '}
              <strong>&ldquo;{projectName}&rdquo;</strong>:
            </Text>

            <Section style={commentBox}>
              <Text style={commentText}>{commentBody}</Text>
            </Section>

            <Section style={buttonSection}>
              <Button style={primaryButton} href={projectUrl}>
                View Project
              </Button>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: '#0a0a0a', fontFamily: 'sans-serif', padding: '40px 0' };
const container = { backgroundColor: '#18181b', borderRadius: '8px', maxWidth: '560px', margin: '0 auto', padding: '32px' };
const logoSection = { marginBottom: '24px' };
const logoIcon = { fontSize: '20px', marginRight: '8px' };
const logoText = { color: '#a1a1aa', fontSize: '13px', fontWeight: '600' as const };
const contentSection = { padding: '0' };
const heading = { color: '#f4f4f5', fontSize: '22px', fontWeight: '700' as const, margin: '0 0 16px' };
const paragraph = { color: '#a1a1aa', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' };
const commentBox = { backgroundColor: '#27272a', borderRadius: '6px', padding: '16px', margin: '0 0 24px', borderLeft: '3px solid #7c3aed' };
const commentText = { color: '#d4d4d8', fontSize: '14px', lineHeight: '22px', margin: '0', fontStyle: 'italic' as const };
const buttonSection = { margin: '16px 0' };
const primaryButton = { backgroundColor: '#7c3aed', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 24px', textDecoration: 'none', display: 'inline-block' };
