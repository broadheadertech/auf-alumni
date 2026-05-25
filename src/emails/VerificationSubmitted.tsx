import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  recipientName?: string;
};

export function VerificationSubmittedEmail({ recipientName }: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>We&apos;ve received your AUF verification submission.</Preview>
      <Body
        style={{
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: "#fafafa",
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            maxWidth: 560,
            margin: "0 auto",
            padding: 32,
          }}
        >
          <Heading style={{ fontSize: 20, margin: 0 }}>
            We&apos;ve got your submission
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              Thanks for submitting your AUF verification. Our team is checking
              your name against the AUF alumni registry. Median turnaround is
              under 48 hours.
            </Text>
            <Text>
              You can check your status anytime at the verification page —
              we&apos;ll also email you the moment we have a decision.
            </Text>
            <Text style={{ color: "#666", fontSize: 13 }}>
              — AUF Alumni Network
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default VerificationSubmittedEmail;
