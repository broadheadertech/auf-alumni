import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to set up your Alumni ID — AUF Alumni Network",
  description:
    "Step-by-step guide for AUF alumni: how your Alumni ID is issued, how to set your security PIN, and how to view, save, and share your verifiable digital credential.",
};

type Step = { n: number; title: string; body: string };

const PIN_STEPS: Step[] = [
  {
    n: 1,
    title: "Open the “Set your ID PIN” email from AUF",
    body: "Tap the activation link inside it. The link works on any device — phone or laptop — but it can only be used once and expires 30 minutes after it is sent.",
  },
  {
    n: 2,
    title: "Check that your name is shown",
    body: "The activation page displays your name at the top. This confirms the link is really yours before you set anything.",
  },
  {
    n: 3,
    title: "Enter a 4–6 digit PIN",
    body: "Choose a code you will remember but others can’t guess — avoid obvious ones like 1234 or your birth year.",
  },
  {
    n: 4,
    title: "Re-enter the same PIN to confirm",
    body: "Type it again in the “Confirm PIN” box so there are no typos.",
  },
  {
    n: 5,
    title: "Tap “Activate my ID”",
    body: "You’ll see “Your ID is active.” Your card is now ready to use, and you can open your digital ID right away.",
  },
];

const VIEW_STEPS: Step[] = [
  {
    n: 1,
    title: "Sign in and open My Alumni ID",
    body: "Your ID is issued automatically the moment your verification is approved — usually within 2 business days. If verification is still pending, your card appears here once you’re approved.",
  },
  {
    n: 2,
    title: "Review your credential",
    body: "Your card shows your name, batch, program, your Alumni ID number, and a QR code.",
  },
  {
    n: 3,
    title: "Save or print it",
    body: "Tap Save / Print to keep a copy on your phone or print a physical version.",
  },
  {
    n: 4,
    title: "Let anyone verify it",
    body: "Anyone can scan the QR code — or visit auf.edu.ph/i/your-id — to instantly confirm your credential is genuine.",
  },
];

function StepList({ steps }: { steps: Step[] }) {
  return (
    <ol className="mt-5 space-y-4">
      {steps.map((s) => (
        <li key={s.n} className="flex gap-4">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-[15px] font-semibold"
            style={{
              background: "var(--brand-deep)",
              color: "var(--gold)",
            }}
            aria-hidden
          >
            {s.n}
          </span>
          <div className="pt-0.5">
            <div className="font-medium text-[15px]">{s.title}</div>
            <p className="text-[14px] ink-2 mt-1 leading-[1.6]">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function HowToSetUpAlumniIdPage() {
  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <div className="section-eyebrow brand-fg mb-3">Alumni guide</div>
      <h1 className="font-serif text-[40px] sm:text-[48px] leading-tight font-semibold">
        Setting up your Alumni ID
      </h1>
      <p className="text-[16px] ink-2 mt-4 leading-[1.6] max-w-[62ch]">
        Your Alumni ID is your official, verifiable AUF credential (for example{" "}
        <span className="font-mono text-[14px]">AUF-2015-000123</span>). It is
        issued to you automatically — you don’t request it — and it’s safe to
        share: anyone can scan its QR code to confirm you’re a real, verified
        AUF graduate. There are two parts: your ID is{" "}
        <strong>issued</strong>, and you set a <strong>PIN</strong> to activate
        your card.
      </p>

      {/* PIN */}
      <section className="mt-12">
        <h2 className="font-serif text-[24px]">
          How to set your ID PIN{" "}
          <span className="ink-3 text-[16px] font-sans">
            (your second security factor)
          </span>
        </h2>
        <p className="text-[15px] ink-2 mt-3 leading-[1.65] max-w-[62ch]">
          Your PIN is a <strong>4–6 digit</strong> code that acts as the second
          security factor when you tap your alumni card at AUF checkpoints.{" "}
          <strong>Only you know it</strong> — AUF staff can never see it.
        </p>
        <div className="auf-card p-6 mt-5">
          <StepList steps={PIN_STEPS} />
        </div>
        <div
          className="mt-4 rounded-lg p-4 text-[14px] ink-2 leading-[1.6]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-soft)",
          }}
        >
          <strong>If the link says it’s expired or already used:</strong> for
          your security each link only works once. Contact AUF Alumni Relations
          and ask them to reissue your activation link.
        </div>
      </section>

      {/* View / save */}
      <section className="mt-14">
        <h2 className="font-serif text-[24px]">
          How to view and save your digital Alumni ID
        </h2>
        <div className="auf-card p-6 mt-5">
          <StepList steps={VIEW_STEPS} />
        </div>
        <div
          className="mt-4 rounded-lg p-4 text-[14px] leading-[1.6]"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-soft)",
          }}
        >
          <span className="ink-2">
            <strong>Keep private:</strong> your PIN.{" "}
            <strong>Safe to share:</strong> your Alumni ID number and QR code —
            that’s the public part.
          </span>
        </div>
      </section>

      {/* Help footer */}
      <section className="mt-14 auf-card p-6">
        <h2 className="font-serif text-[20px] font-semibold">
          Need a hand?
        </h2>
        <p className="text-[14px] ink-2 mt-2 leading-[1.6]">
          Email{" "}
          <a
            href="mailto:support@auf.edu.ph"
            className="brand-fg underline underline-offset-4"
          >
            support@auf.edu.ph
          </a>{" "}
          and we’ll get back to you within one business day, or browse the{" "}
          <Link
            href="/help"
            className="brand-fg underline underline-offset-4"
          >
            Help center
          </Link>
          . For urgent registrar questions, reach AUF Alumni Relations at +63
          (45) 625-2999 (extension 8).
        </p>
      </section>
    </div>
  );
}
