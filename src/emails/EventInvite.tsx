import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type Props = {
  recipientName?: string;
  eventTitle: string;
  eventWhen: string;
  eventLocation: string;
  eventDescription: string;
  yesUrl: string;
  maybeUrl: string;
  noUrl: string;
};

export function EventInviteEmail({
  recipientName,
  eventTitle,
  eventWhen,
  eventLocation,
  eventDescription,
  yesUrl,
  maybeUrl,
  noUrl,
}: Props) {
  const name = recipientName ?? "there";
  return (
    <Html>
      <Head />
      <Preview>You&apos;re invited: {eventTitle}</Preview>
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
          <Text
            style={{
              color: "#b8860b",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            AUF Alumni Network · You&apos;re invited
          </Text>
          <Heading style={{ fontSize: 22, margin: "6px 0 0" }}>
            {eventTitle}
          </Heading>
          <Section style={{ marginTop: 12 }}>
            <Text style={{ margin: "2px 0", fontWeight: 600 }}>🗓 {eventWhen}</Text>
            <Text style={{ margin: "2px 0", fontWeight: 600 }}>📍 {eventLocation}</Text>
          </Section>
          <Hr style={{ borderColor: "#eee", margin: "16px 0" }} />
          <Text>Hi {name},</Text>
          <Text style={{ whiteSpace: "pre-wrap" }}>{eventDescription}</Text>

          <Section style={{ marginTop: 20 }}>
            <Text style={{ fontSize: 13, color: "#555", margin: "0 0 8px" }}>
              Will you attend?
            </Text>
            <Button
              href={yesUrl}
              style={{
                backgroundColor: "#0f172a",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
                marginRight: 8,
              }}
            >
              Yes, I will attend
            </Button>
            <Button
              href={maybeUrl}
              style={{
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "1px solid #cbd5e1",
                padding: "9px 16px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
                marginRight: 8,
              }}
            >
              Maybe
            </Button>
            <Button
              href={noUrl}
              style={{
                backgroundColor: "#ffffff",
                color: "#64748b",
                border: "1px solid #e2e8f0",
                padding: "9px 16px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Can&apos;t make it
            </Button>
          </Section>

          <Text style={{ color: "#666", fontSize: 13, marginTop: 24 }}>
            — AUF Alumni Network
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default EventInviteEmail;
