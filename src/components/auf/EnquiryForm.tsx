"use client";

/**
 * Public "talk to AUF" form. Writes an enquiry to Convex (convex/enquiries.ts)
 * so nothing depends on the visitor having a mail client — the Office of
 * Alumni Relations triages from Admin → Enquiries, and a copy is emailed to
 * the address for that topic.
 *
 * `?topic=` preselects the channel (e.g. /contact?topic=employer from the
 * "Talk to AUF Career Services" button).
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, Loader2, Send } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const TOPICS = [
  { value: "general", label: "General enquiry" },
  { value: "support", label: "Account support" },
  { value: "employer", label: "Employer partnerships" },
  { value: "privacy", label: "Data privacy (DPO)" },
  { value: "security", label: "Security" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

export function EnquiryForm({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <Inner className={className} />
    </Suspense>
  );
}

function Inner({ className }: { className?: string }) {
  const sp = useSearchParams();
  const pathname = usePathname();
  const submit = useMutation(api.enquiries.submit);
  const me = useQuery(api.users.getMe);

  const initial = sp.get("topic");
  const [topic, setTopic] = useState<Topic>(
    (TOPICS.some((t) => t.value === initial) ? (initial as Topic) : "general"),
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organisation, setOrganisation] = useState("");
  // `?plan=` comes from the employer pricing cards on /for-employers, so the
  // enquiry that lands in the admin inbox says which plan they were looking at.
  const planParam = sp.get("plan");
  const [message, setMessage] = useState(() =>
    planParam && /^[a-z]{3,20}$/.test(planParam)
      ? `I'd like to know more about the ${
          planParam.charAt(0).toUpperCase() + planParam.slice(1)
        } plan for hiring AUF alumni.

`
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  // Prefill from the signed-in account once it loads (once, and only into
  // fields the visitor hasn't typed in).
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current || !me) return;
    prefilled.current = true;
    // Signed-in visitors shouldn't retype what we already know; this runs once.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (me.name) setName((v) => v || me.name || "");
    if (me.email) setEmail((v) => v || me.email || "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [me]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submit({
        topic,
        name,
        email,
        organisation: topic === "employer" ? organisation : undefined,
        message,
        sourcePath: pathname,
      });
      setSent(true);
      setMessage("");
      toast.success("Message sent — we'll reply within one business day.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send your message");
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className={className}>
        <div className="auf-card p-6 text-center">
          <Check className="mx-auto h-8 w-8 brand-fg" />
          <h3 className="font-serif text-[20px] font-semibold mt-2">Message sent</h3>
          <p className="text-[14px] ink-2 mt-1">
            The Office of Alumni Relations replies within one business day.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="auf-btn auf-btn-outline auf-btn-sm mt-4"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="auf-card p-6 space-y-4">
        <div>
          <Label htmlFor="enq-topic">What is this about?</Label>
          <select
            id="enq-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value as Topic)}
            className="mt-1.5 h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm"
          >
            {TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="enq-name">Your name</Label>
            <Input
              id="enq-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="enq-email">Email</Label>
            <Input
              id="enq-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              required
              className="mt-1.5"
            />
          </div>
        </div>
        {topic === "employer" && (
          <div>
            <Label htmlFor="enq-org">Company</Label>
            <Input
              id="enq-org"
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              maxLength={120}
              placeholder="Who are you hiring for?"
              className="mt-1.5"
            />
          </div>
        )}
        <div>
          <Label htmlFor="enq-message">Message</Label>
          <Textarea
            id="enq-message"
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minLength={10}
            maxLength={4000}
            required
            placeholder={
              topic === "employer"
                ? "Tell us the roles you're hiring for and the batches or programs you're after."
                : "How can we help?"
            }
            className="mt-1.5"
          />
          <p className="mt-1 text-right text-[11px] ink-3 tabular-nums">
            {message.trim().length}/4000
          </p>
        </div>
        <Button type="submit" disabled={busy || message.trim().length < 10}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
