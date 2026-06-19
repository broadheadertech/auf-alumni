"use client";

import { useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EVENT_CATEGORIES = [
  { value: "reunion", label: "Reunion" },
  { value: "webinar", label: "Webinar" },
  { value: "meetup", label: "Meetup" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_NONE = "none";

type AgendaRow = { time: string; title: string; description: string };

export default function NewEventPage() {
  const router = useRouter();
  const publishEvent = useMutation(api.events.publishEvent);
  const generateCoverUploadUrl = useMutation(api.events.generateCoverUploadUrl);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [onlineUrl, setOnlineUrl] = useState("");
  const [capacity, setCapacity] = useState("");
  const [audienceBatches, setAudienceBatches] = useState<number[]>([]);
  const [audiencePrograms, setAudiencePrograms] = useState<string[]>([]);
  const [category, setCategory] = useState<string>(CATEGORY_NONE);
  const [agenda, setAgenda] = useState<AgendaRow[]>([]);
  const [coverStorageId, setCoverStorageId] = useState<string | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onCoverChange = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await generateCoverUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const json = (await res.json()) as { storageId: string };
      setCoverStorageId(json.storageId);
      setCoverPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
    } catch (err) {
      // Failed upload: surface a toast and leave the rest of the form intact.
      toast.error(err instanceof Error ? err.message : "Cover upload failed");
      if (coverInputRef.current) coverInputRef.current.value = "";
    } finally {
      setUploadingCover(false);
    }
  };

  const removeCover = () => {
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCoverStorageId(null);
    if (coverInputRef.current) coverInputRef.current.value = "";
  };

  const addAgendaRow = () =>
    setAgenda((cur) => [...cur, { time: "", title: "", description: "" }]);
  const removeAgendaRow = (index: number) =>
    setAgenda((cur) => cur.filter((_, i) => i !== index));
  const updateAgendaRow = (index: number, patch: Partial<AgendaRow>) =>
    setAgenda((cur) =>
      cur.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Enter-key submits bypass the disabled button — bail while a cover
    // upload is in flight or a submit is already in progress.
    if (submitting || uploadingCover) return;
    if (!title.trim() || !description.trim() || !startsAt) {
      toast.error("Title, description, and start time are required");
      return;
    }
    // Drop agenda rows without a title before submit (a row with only
    // time/description is incomplete and must not be sent).
    const agendaItems = agenda
      .map((row) => ({
        time: row.time.trim(),
        title: row.title.trim(),
        description: row.description.trim(),
      }))
      .filter((row) => row.title)
      .map((row) => ({
        time: row.time,
        title: row.title,
        description: row.description || undefined,
      }));
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
        coverImageStorageId: coverStorageId
          ? (coverStorageId as unknown as never)
          : undefined,
        category:
          category === CATEGORY_NONE
            ? undefined
            : (category as "reunion" | "webinar" | "meetup" | "other"),
        agenda: agendaItems.length ? agendaItems : undefined,
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

            <div>
              <Label htmlFor="coverImage">Cover image (optional)</Label>
              <Input
                ref={coverInputRef}
                id="coverImage"
                type="file"
                accept="image/*"
                onChange={onCoverChange}
                disabled={uploadingCover}
              />
              {uploadingCover && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Uploading cover…
                </p>
              )}
              {coverPreviewUrl && coverStorageId && (
                <div className="mt-2 space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreviewUrl}
                    alt="Cover preview"
                    className="aspect-[2/1] w-full rounded-md border border-border object-cover"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={removeCover}
                  >
                    Remove cover
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="category">Category (optional)</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v ?? CATEGORY_NONE)}
              >
                <SelectTrigger id="category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_NONE}>None</SelectItem>
                  {EVENT_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <fieldset className="space-y-2 rounded-md border border-border p-3">
              <legend className="px-2 text-xs uppercase tracking-wide text-muted-foreground">
                Agenda (optional)
              </legend>
              {agenda.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No agenda items yet — the section is hidden on the event page
                  until you add some.
                </p>
              )}
              {agenda.map((row, i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-md border border-border p-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <Input
                      aria-label={`Agenda item ${i + 1} time`}
                      placeholder="6:00 PM"
                      value={row.time}
                      onChange={(e) =>
                        updateAgendaRow(i, { time: e.target.value })
                      }
                    />
                    <Input
                      aria-label={`Agenda item ${i + 1} title`}
                      placeholder="Registration & cocktails"
                      value={row.title}
                      onChange={(e) =>
                        updateAgendaRow(i, { title: e.target.value })
                      }
                    />
                  </div>
                  <Input
                    aria-label={`Agenda item ${i + 1} description`}
                    placeholder="Description (optional)"
                    value={row.description}
                    onChange={(e) =>
                      updateAgendaRow(i, { description: e.target.value })
                    }
                  />
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeAgendaRow(i)}
                    >
                      Remove item
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addAgendaRow}
              >
                Add agenda item
              </Button>
            </fieldset>

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
              <Button type="submit" disabled={submitting || uploadingCover}>
                {submitting ? "Publishing…" : "Publish event"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
