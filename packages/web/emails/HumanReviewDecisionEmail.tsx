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

interface HumanReviewDecisionEmailProps {
  customerName: string;
  projectName: string;
  decision: 'approved' | 'rejected';
  reviewerNotes?: string;
  projectUrl: string;
  audioUrl?: string;
}

export default function HumanReviewDecisionEmail({
  customerName = 'Creator',
  projectName = 'My Script',
  decision = 'approved',
  reviewerNotes,
  projectUrl = 'https://www.storymagicapp.net/projects/example',
  audioUrl,
}: HumanReviewDecisionEmailProps) {
  const approved = decision === 'approved';

  return (
    <Html>
      <Head />
      <Preview>
        Your audio for &ldquo;{projectName}&rdquo; has been {approved ? 'approved' : 'reviewed'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <span style={logoIcon}>✨</span>
            <span style={logoText}>Story Magic</span>
          </Section>

          <Section style={contentSection}>
            <Heading style={heading}>
              {approved ? '🎉 Your audio has been approved!' : 'Review complete for your project'}
            </Heading>

            <Text style={paragraph}>Hi {customerName},</Text>

            <Text style={paragraph}>
              Your Story Magic project <strong>&ldquo;{projectName}&rdquo;</strong> has been{' '}
              reviewed by our production team and{' '}
              {approved
                ? 'is approved and ready for download.'
                : 'needs some adjustments before delivery.'}
            </Text>

            {reviewerNotes && (
              <Section style={notesBox}>
                <Text style={notesLabel}>Reviewer notes:</Text>
                <Text style={notesText}>{reviewerNotes}</Text>
              </Section>
            )}

            {approved && audioUrl && (
              <Section style={buttonSection}>
                <Button style={approveButton} href={audioUrl}>
                  Download Audio
                </Button>
              </Section>
            )}

            <Section style={buttonSection}>
              <Button style={secondaryButton} href={projectUrl}>
                {approved ? 'View Project' : 'Open Project'}
              </Button>
            </Section>

            <Text style={footer}>
              {approved
                ? 'Thank you for using the white-glove review service.'
                : 'Please re-generate your audio and we will review it again. Contact support if you need help.'}
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
const notesBox = { backgroundColor: '#27272a', borderRadius: '6px', padding: '16px', margin: '0 0 20px' };
const notesLabel = { color: '#71717a', fontSize: '12px', fontWeight: '600' as const, margin: '0 0 8px', textTransform: 'uppercase' as const };
const notesText = { color: '#d4d4d8', fontSize: '14px', lineHeight: '22px', margin: '0' };
const buttonSection = { margin: '16px 0' };
const approveButton = { backgroundColor: '#7c3aed', borderRadius: '6px', color: '#fff', fontSize: '14px', fontWeight: '600' as const, padding: '12px 24px', textDecoration: 'none', display: 'inline-block' };
const secondaryButton = { backgroundColor: '#3f3f46', borderRadius: '6px', color: '#f4f4f5', fontSize: '14px', fontWeight: '600' as const, padding: '12px 24px', textDecoration: 'none', display: 'inline-block' };
const footer = { color: '#52525b', fontSize: '13px', lineHeight: '20px', margin: '24px 0 0' };
