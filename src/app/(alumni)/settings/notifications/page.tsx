"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/convex-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ROWS: { key: string; label: string; description: string }[] = [
  {
    key: "connectionRequestEmail",
    label: "Connection requests — email",
    description: "When someone requests to connect with you",
  },
  {
    key: "connectionRequestInApp",
    label: "Connection requests — in-app",
    description: "Notification appears in the bell dropdown",
  },
  {
    key: "connectionAcceptedEmail",
    label: "Connection accepted — email",
    description: "When someone accepts your connection request",
  },
  {
    key: "connectionAcceptedInApp",
    label: "Connection accepted — in-app",
    description: "Notification appears in the bell dropdown",
  },
  {
    key: "dmEmail",
    label: "Direct messages — email",
    description: "Email summary of new messages (P2)",
  },
  {
    key: "dmInApp",
    label: "Direct messages — in-app",
    description: "Live message notification",
  },
  {
    key: "eventReminderEmail",
    label: "Event reminders — email",
    description: "24h and 1h before events you've RSVP'd to",
  },
  {
    key: "eventReminderInApp",
    label: "Event reminders — in-app",
    description: "Bell-dropdown reminder",
  },
  {
    key: "digestEmail",
    label: "Weekly digest — email",
    description: "Specific named alumni, suggested connections, upcoming events",
  },
  {
    key: "milestonesAuto",
    label: "Auto-generate my work anniversaries",
    description: "When an experience entry crosses a year, post automatically",
  },
];

export default function NotificationSettingsPage() {
  const data = useQuery(api.notifications.getMyPrefs);
  const updatePrefs = useMutation(api.notifications.updatePrefs);
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [freq, setFreq] = useState<string>("weekly");
  const [saving, setSaving] = useState(false);

  /* eslint-disable */
  useEffect(() => {
    if (data) {
      setPrefs(data.prefs);
      setFreq(data.digestFrequency);
    }
  }, [data]);
  /* eslint-enable */

  if (data === undefined) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const toggle = (key: string) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await updatePrefs({ prefs, digestFrequency: freq });
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Notification preferences
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Decide which channels can reach you. Defaults are conservative —
        connection-related events on, broad emails off-by-noise.
      </p>

      <Card className="mt-6">
        <CardContent className="space-y-3 p-6">
          {ROWS.map((r) => (
            <label
              key={r.key}
              className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <span>
                <span className="block text-sm font-medium">{r.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {r.description}
                </span>
              </span>
              <input
                type="checkbox"
                checked={prefs[r.key] ?? true}
                onChange={() => toggle(r.key)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-6">
          <Label htmlFor="freq">Digest frequency</Label>
          <select
            id="freq"
            value={freq}
            onChange={(e) => setFreq(e.target.value)}
            className="mt-2 block rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            <option value="weekly">Weekly (Sunday evening PHT)</option>
            <option value="off">Off</option>
          </select>
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-end">
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
