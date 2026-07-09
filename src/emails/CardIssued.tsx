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
  activationUrl: string;
};

export function CardIssuedEmail({ recipientName, activationUrl }: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>Your AUF Alumni ID has been issued — set your PIN.</Preview>
      <Body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
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
            Your Alumni ID is ready
          </Heading>
          <Section>
            <Text>Hi {name},</Text>
            <Text>
              Angeles University Foundation has issued your physical Alumni ID
              card. To finish activation, set a private <strong>PIN</strong> —
              this is your second security factor when the card is tapped.
            </Text>
            <Text style={{ color: "#666", fontSize: 13 }}>
              Only you should know this PIN. AUF staff cannot see it.
            </Text>
            <Button
              href={activationUrl}
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
              Set my PIN
            </Button>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 20 }}>
              This link is single-use and expires shortly. If you didn&apos;t
              request this, you can ignore it.
            </Text>
            <Text style={{ color: "#666", fontSize: 13, marginTop: 16 }}>
              — AUF Alumni Network
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default CardIssuedEmail;
