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

interface HumanReviewRequestEmailProps {
  projectName: string;
  customerName: string;
  reviewQueueUrl: string;
  audioUrl?: string;
}

export default function HumanReviewRequestEmail({
  projectName = 'My Script',
  customerName = 'A customer',
  reviewQueueUrl = 'https://www.storymagicapp.net/admin/review-queue',
  audioUrl,
}: HumanReviewRequestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New audio ready for human review — {projectName}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <span style={logoIcon}>✨</span>
            <span style={logoText}>Story Magic — Review Queue</span>
          </Section>

          <Section style={contentSection}>
            <Heading style={heading}>New audio ready for review</Heading>

            <Text style={paragraph}>
              <strong>{customerName}</strong> has purchased a white-glove review for their
              project <strong>&ldquo;{projectName}&rdquo;</strong>. The audio has finished
              generating and is waiting for your approval.
            </Text>

            {audioUrl && (
              <Text style={paragraph}>
                Audio file:{' '}
                <a href={audioUrl} style={link}>{audioUrl}</a>
              </Text>
            )}

            <Section style={buttonSection}>
              <Button style={button} href={reviewQueueUrl}>
                Open Review Queue
              </Button>
            </Section>

            <Text style={footer}>
              Once you approve or reject, the customer will be notified automatically.
            </Text>
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
const link = { color: '#7c3aed' };
const buttonSection = { margin: '24px 0' };
const button = { backgroundColor: '#7c3aed', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 24px', textDecoration: 'none', display: 'inline-block' };
const footer = { color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '24px 0 0' };
