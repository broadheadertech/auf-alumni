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
  message: string;
  updateUrl: string;
};

export function VerificationInfoRequestedEmail({
  recipientName,
  message,
  updateUrl,
}: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>We need a small update to your AUF verification.</Preview>
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
            More info needed
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              Our reviewer needs a small update before we can approve your
              verification:
            </Text>
            <Text style={{ color: "#444", fontStyle: "italic" }}>
              {message}
            </Text>
            <Text>
              You can update your submission here:{" "}
              <a href={updateUrl} style={{ color: "#0f172a" }}>
                {updateUrl}
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

export default VerificationInfoRequestedEmail;
