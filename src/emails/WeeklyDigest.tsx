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
import type { DigestModel } from "../../convex/digestModel";

type Props = DigestModel;

const sectionHeadingStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: "#0f172a",
  margin: "0 0 4px",
} as const;

const sectionStyle = {
  borderTop: "1px solid #e5e5e5",
  marginTop: 20,
  paddingTop: 16,
} as const;

const linkStyle = { color: "#0f172a" } as const;

const mutedStyle = { color: "#666", fontSize: 13 } as const;

function previewLine(model: Props): string {
  if (model.batchmates) {
    const items = model.batchmates.items;
    const first = items[0];
    return items.length > 1
      ? `${first.name} ${first.detail} — and more from your batch`
      : `${first.name} ${first.detail}`;
  }
  if (model.mentorship) return model.mentorship.headline;
  if (model.jobs) return `${model.jobs.items[0].title} and other roles for you`;
  if (model.event) return `Upcoming: ${model.event.title}`;
  return "Your week in the AUF Alumni network";
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

export function WeeklyDigest(model: Props) {
  const { recipientName, batchmates, mentorship, jobs, event, settingsUrl } =
    model;
  return (
    <Html>
      <Head />
      <Preview>{previewLine(model)}</Preview>
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
            Your week in the AUF Alumni network
          </Heading>
          <Text style={{ marginTop: 8 }}>Hi {recipientName},</Text>

          {batchmates && (
            <Section style={sectionStyle}>
              <Text style={sectionHeadingStyle}>Batchmate updates</Text>
              {batchmates.items.map((item) => (
                <Text key={item.profileUrl} style={{ margin: "4px 0" }}>
                  <a href={item.profileUrl} style={linkStyle}>
                    {item.name}
                  </a>{" "}
                  {item.detail}
                </Text>
              ))}
            </Section>
          )}

          {mentorship && (
            <Section style={sectionStyle}>
              <Text style={sectionHeadingStyle}>Mentorship in your cohort</Text>
              <Text style={{ margin: "4px 0" }}>
                {mentorship.headline}
                {mentorship.sampleNames.length > 0 && (
                  <> — including {joinNames(mentorship.sampleNames)}</>
                )}
                .
              </Text>
              <Text style={{ margin: "4px 0" }}>
                <a href={mentorship.directoryUrl} style={linkStyle}>
                  Browse them in the directory
                </a>
              </Text>
            </Section>
          )}

          {jobs && (
            <Section style={sectionStyle}>
              <Text style={sectionHeadingStyle}>Jobs matching your profile</Text>
              {jobs.items.map((job) => (
                <Text key={job.jobUrl} style={{ margin: "4px 0" }}>
                  <a href={job.jobUrl} style={linkStyle}>
                    {job.title}
                  </a>
                  {job.companyName ? ` at ${job.companyName}` : ""}
                  <span style={mutedStyle}> · {job.location}</span>
                </Text>
              ))}
            </Section>
          )}

          {event && (
            <Section style={sectionStyle}>
              <Text style={sectionHeadingStyle}>Upcoming event</Text>
              <Text style={{ margin: "4px 0" }}>
                <a href={event.eventUrl} style={linkStyle}>
                  {event.title}
                </a>
              </Text>
              <Text style={{ ...mutedStyle, margin: "4px 0" }}>
                {event.whenLabel}
                {event.locationLabel ? ` · ${event.locationLabel}` : ""}
              </Text>
            </Section>
          )}

          <Text style={{ ...mutedStyle, marginTop: 24 }}>
            — AUF Alumni Network
          </Text>
          <Text style={{ ...mutedStyle, fontSize: 12 }}>
            You receive this weekly digest because it is enabled in your
            notification settings.{" "}
            <a href={settingsUrl} style={linkStyle}>
              Manage your email preferences
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyDigest;
