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
  note?: string;
  inboxUrl: string;
};

export function ConnectionRequestEmail({
  recipientName,
  requesterName,
  note,
  inboxUrl,
}: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>{requesterName} wants to connect on AUF Alumni</Preview>
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
            {requesterName} wants to connect
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              {requesterName}, a verified AUF alumna, sent you a connection
              request.
            </Text>
            {note && (
              <Text
                style={{
                  borderLeft: "3px solid #e5e5e5",
                  paddingLeft: 12,
                  color: "#444",
                  fontStyle: "italic",
                }}
              >
                “{note}”
              </Text>
            )}
            <Text>
              <a href={inboxUrl} style={{ color: "#0f172a" }}>
                Open your inbox to respond
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

export default ConnectionRequestEmail;
