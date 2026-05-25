"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/lib/convex-api";
import { BATCHES, PROGRAMS } from "@/lib/mock-alumni";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

export default function NewEventPage() {
  const router = useRouter();
  const publishEvent = useMutation(api.events.publishEvent);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [capacity, setCapacity] = useState("");
  const [audienceBatches, setAudienceBatches] = useState<number[]>([]);
  const [audiencePrograms, setAudiencePrograms] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startsAt) {
      toast.error("Title, description, and start time are required");
      return;
    }
    setSubmitting(true);
    try {
      await publishEvent({
        title: title.trim(),
        description: description.trim(),
        startsAt: new Date(startsAt).getTime(),
        locationLabel: locationLabel.trim() || undefined,
        onlineUrl: onlineUrl.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        audienceBatches: audienceBatches.length ? audienceBatches : undefined,
        audiencePrograms: audiencePrograms.length ? audiencePrograms : undefined,
      });
      toast.success("Event published");
      router.push("/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Publish event</h1>
      <Card className="mt-6">
        <CardContent className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="startsAt">Starts at</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="capacity">Capacity (optional)</Label>
                <Input
                  id="capacity"
                  type="number"
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="locationLabel">Location label</Label>
              <Input
                id="locationLabel"
                placeholder="e.g. Marquee Mall Atrium, Pampanga"
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="onlineUrl">Online link (optional)</Label>
              <Input
                id="onlineUrl"
                type="url"
                value={onlineUrl}
                onChange={(e) => setOnlineUrl(e.target.value)}
              />
            </div>

            <fieldset className="space-y-2 rounded-md border border-border p-3">
              <legend className="px-2 text-xs uppercase tracking-wide text-muted-foreground">
                Audience filter (leave empty = all verified alumni)
              </legend>
              <div>
                <Label className="text-xs">Batches</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {BATCHES.map((b) => {
                    const active = audienceBatches.includes(b);
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() =>
                          setAudienceBatches((cur) =>
                            cur.includes(b)
                              ? cur.filter((x) => x !== b)
                              : [...cur, b],
                          )
                        }
                        className={
                          "rounded-full border px-2 py-0.5 text-xs " +
                          (active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:bg-muted")
                        }
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs">Programs</Label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {PROGRAMS.map((p) => {
                    const active = audiencePrograms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() =>
                          setAudiencePrograms((cur) =>
                            cur.includes(p)
                              ? cur.filter((x) => x !== p)
                              : [...cur, p],
                          )
                        }
                        className={
                          "rounded-full border px-2 py-0.5 text-xs " +
                          (active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background text-muted-foreground hover:bg-muted")
                        }
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            </fieldset>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Publishing…" : "Publish event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
