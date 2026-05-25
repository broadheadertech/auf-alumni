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
  requesterName: string;
  directoryUrl: string;
};

export function ConnectionAcceptedEmail({
  recipientName,
  requesterName,
  directoryUrl,
}: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>{requesterName} accepted your connection request</Preview>
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
            You&apos;re connected
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              {requesterName} accepted your connection request. You can now
              browse their full profile.
            </Text>
            <Text>
              <a href={directoryUrl} style={{ color: "#0f172a" }}>
                Open the directory
              </a>
            </Text>
            <Text style={{ color: "#666", fontSize: 13, marginTop: 24 }}>
              — AUF Alumni Network
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ConnectionAcceptedEmail;
