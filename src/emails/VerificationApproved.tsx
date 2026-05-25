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
} from "@react-email/components";

type Props = {
  recipientName?: string;
  directoryUrl: string;
};

export function VerificationApprovedEmail({ recipientName, directoryUrl }: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>You&apos;re verified. Welcome to AUF Alumni.</Preview>
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
            You&apos;re verified
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              Your AUF affiliation has been confirmed. You can now use the full
              alumni network — search the directory, send connection requests,
              and (soon) RSVP to events and explore opportunities.
            </Text>
            <Button
              href={directoryUrl}
              style={{
                backgroundColor: "#0f172a",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
                marginTop: 8,
              }}
            >
              Open the directory
            </Button>
            <Text style={{ color: "#666", fontSize: 13, marginTop: 24 }}>
              — AUF Alumni Network
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default VerificationApprovedEmail;
