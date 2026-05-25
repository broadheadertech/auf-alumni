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
  reason: string;
  reapplyUrl: string;
};

export function VerificationRejectedEmail({
  recipientName,
  reason,
  reapplyUrl,
}: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>An update on your AUF verification.</Preview>
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
            Verification not approved
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>We weren&apos;t able to confirm your AUF affiliation.</Text>
            <Text style={{ color: "#444", fontStyle: "italic" }}>{reason}</Text>
            <Text>
              You can update your submission with the requested changes here:
            </Text>
            <Text>
              <a href={reapplyUrl} style={{ color: "#0f172a" }}>
                {reapplyUrl}
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

export default VerificationRejectedEmail;
