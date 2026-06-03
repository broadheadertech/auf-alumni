"use client";

/**
 * Client-side social-graph surface for the public profile page.
 *
 * Mounts below the server-rendered profile header and renders:
 *   - Follower / following counts + Follow / Unfollow action
 *   - Skills with per-skill endorsement counts, recent endorsers, and
 *     Endorse / Endorsed toggle
 *   - Published recommendations (+ a Write CTA for non-self viewers, and
 *     a Pending-approval sub-section for the profile owner)
 *
 * The page server-renders deterministic + SEO-critical content (header,
 * bio) and passes `profile._id`, `profile.skills`, and the server-computed
 * `isMe` flag down to this component as plain props so we never re-fetch
 * the profile on the client.
 */

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import {
  Briefcase,
  Loader2,
  Star,
  ThumbsUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AUFAvatar } from "@/components/auf/AUFAvatar";
import { cn } from "@/lib/utils";

type Props = {
  /** Convex `Id<"users">` for the profile owner. Stringified across the
   *  server/client boundary; cast back to `never` at the call site. */
  profileUserId: string;
  /** Skills already loaded server-side from the profile. */
  skills: string[];
  /** Whether the signed-in viewer owns this profile. Computed server-side. */
  isMe: boolean;
};

const RELATIONSHIPS = [
  { value: "manager", label: "Manager" },
  { value: "report", label: "Direct report" },
  { value: "peer", label: "Peer / colleague" },
  { value: "client", label: "Client" },
  { value: "classmate", label: "Classmate" },
  { value: "mentor", label: "Mentor" },
] as const;

export function ProfileSocial({ profileUserId, skills, isMe }: Props) {
  const me = useQuery(api.users.getMe);
  const signedIn = me != null;
  // The server's `isMe` is authoritative when the viewer is signed in as
  // the slug owner. Cross-check the client `me` so a stale prop doesn't
  // show endorse buttons against yourself.
  const viewerIsOwner = isMe || (signedIn && me?._id === profileUserId);

  return (
    <div className="mt-6 space-y-6">
      <SkillsEndorsements
        profileUserId={profileUserId}
        skills={skills}
        viewerIsOwner={viewerIsOwner}
        signedIn={signedIn}
      />
      <Recommendations
        profileUserId={profileUserId}
        viewerIsOwner={viewerIsOwner}
        signedIn={signedIn}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Follow button + counts (used in the page header, exported standalone)
// ─────────────────────────────────────────────────────────────

export function FollowControl({
  profileUserId,
  isMe,
}: {
  profileUserId: string;
  isMe: boolean;
}) {
  const me = useQuery(api.users.getMe);
  const signedIn = me != null;
  const viewerIsOwner = isMe || (signedIn && me?._id === profileUserId);
  const counts = useQuery(api.social.followCounts, {
    userId: profileUserId as unknown as never,
  });
  const follow = useMutation(api.social.follow);
  const unfollow = useMutation(api.social.unfollow);
  const [busy, setBusy] = useState(false);
  const [armedUnfollow, setArmedUnfollow] = useState(false);

  const followers = counts?.followers ?? 0;
  const following = counts?.following ?? 0;
  const amFollowing = counts?.amFollowing ?? false;

  const handleFollow = async () => {
    setBusy(true);
    try {
      await follow({ followeeId: profileUserId as unknown as never });
      toast.success("Following");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not follow");
    } finally {
      setBusy(false);
    }
  };

  const handleUnfollow = async () => {
    setBusy(true);
    try {
      await unfollow({ followeeId: profileUserId as unknown as never });
      toast.success("Unfollowed");
      setArmedUnfollow(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unfollow");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="ink-2">
        <span className="font-semibold text-foreground">{followers}</span>{" "}
        follower{followers === 1 ? "" : "s"}
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="font-semibold text-foreground">{following}</span>{" "}
        following
      </span>
      {!viewerIsOwner && signedIn && (
        <>
          {amFollowing ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              title={armedUnfollow ? "Click again to confirm" : "Unfollow"}
              onClick={() => {
                if (armedUnfollow) handleUnfollow();
                else setArmedUnfollow(true);
              }}
              onBlur={() => setArmedUnfollow(false)}
            >
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserCheck className="mr-1 h-3.5 w-3.5" />
              )}
              {armedUnfollow ? "Confirm unfollow" : "Following"}
            </Button>
          ) : (
            <Button size="sm" disabled={busy} onClick={handleFollow}>
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <UserPlus className="mr-1 h-3.5 w-3.5" />
              )}
              Follow
            </Button>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skills & endorsements
// ─────────────────────────────────────────────────────────────

type EndorsementRow = {
  skill: string;
  count: number;
  recent: Array<{ name: string; slug: string | null }>;
  iEndorsed: boolean;
};

function SkillsEndorsements({
  profileUserId,
  skills,
  viewerIsOwner,
  signedIn,
}: {
  profileUserId: string;
  skills: string[];
  viewerIsOwner: boolean;
  signedIn: boolean;
}) {
  const rows = useQuery(api.social.listEndorsements, {
    profileUserId: profileUserId as unknown as never,
  }) as EndorsementRow[] | undefined;
  const endorse = useMutation(api.social.endorse);
  const removeEndorsement = useMutation(api.social.removeEndorsement);
  const [busy, setBusy] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<string | null>(null);

  if (!skills || skills.length === 0) {
    return null;
  }

  const byName = new Map<string, EndorsementRow>();
  for (const r of rows ?? []) byName.set(r.skill, r);

  const handleToggle = async (skill: string, currentlyEndorsed: boolean) => {
    setBusy(skill);
    try {
      if (currentlyEndorsed) {
        await removeEndorsement({
          profileUserId: profileUserId as unknown as never,
          skill,
        });
        toast.success(`Endorsement removed`);
      } else {
        await endorse({
          profileUserId: profileUserId as unknown as never,
          skill,
        });
        toast.success(`Endorsed ${skill}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not endorse");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="auf-card">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 brand-fg" aria-hidden="true" />
          <h2 className="font-serif text-lg font-semibold">
            Skills &amp; endorsements
          </h2>
        </div>
        <ul className="space-y-2">
          {skills.map((skill) => {
            const row = byName.get(skill);
            const count = row?.count ?? 0;
            const iEndorsed = row?.iEndorsed ?? false;
            const recent = row?.recent ?? [];
            const open = revealed === skill;
            return (
              <li
                key={skill}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background p-3"
              >
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealed(open ? null : skill)}
                    className="inline-flex items-center gap-2 text-left text-sm font-medium hover:underline"
                    aria-expanded={open}
                    aria-controls={`endorsers-${skill}`}
                  >
                    <span>{skill}</span>
                    <span
                      className={cn(
                        "auf-chip",
                        count > 0 && "auf-chip-brand",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                  {open && recent.length > 0 && (
                    <div
                      id={`endorsers-${skill}`}
                      className="flex w-full flex-wrap items-center gap-2 pt-2"
                    >
                      <span className="text-xs ink-2">Recent:</span>
                      {recent.map((r, i) =>
                        r.slug ? (
                          <Link
                            key={`${r.slug}-${i}`}
                            href={`/u/${r.slug}`}
                            className="inline-flex items-center gap-1.5 text-xs hover:underline"
                          >
                            <AUFAvatar
                              name={r.name}
                              size={20}
                              grad={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}
                            />
                            <span>{r.name}</span>
                          </Link>
                        ) : (
                          <span
                            key={`anon-${i}`}
                            className="inline-flex items-center gap-1.5 text-xs ink-2"
                          >
                            <AUFAvatar
                              name={r.name}
                              size={20}
                              grad={((i % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6}
                            />
                            <span>{r.name}</span>
                          </span>
                        ),
                      )}
                    </div>
                  )}
                </div>
                {!viewerIsOwner && signedIn && (
                  <Button
                    size="xs"
                    variant={iEndorsed ? "outline" : "secondary"}
                    disabled={busy === skill}
                    onClick={() => handleToggle(skill, iEndorsed)}
                  >
                    {busy === skill ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <ThumbsUp className="mr-1 h-3 w-3" />
                    )}
                    {iEndorsed ? "Endorsed" : "Endorse"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Recommendations
// ─────────────────────────────────────────────────────────────

type PublishedRec = {
  _id: string;
  authorName: string;
  authorSlug: string | null;
  authorRole: string | null;
  authorCompany: string | null;
  relationship: string;
  body: string;
  decidedAt: number;
};

type PendingRec = {
  _id: string;
  authorName: string;
  authorSlug: string | null;
  relationship: string;
  body: string;
  createdAt: number;
};

function Recommendations({
  profileUserId,
  viewerIsOwner,
  signedIn,
}: {
  profileUserId: string;
  viewerIsOwner: boolean;
  signedIn: boolean;
}) {
  const published = useQuery(api.social.listPublishedRecommendations, {
    subjectUserId: profileUserId as unknown as never,
  }) as PublishedRec[] | undefined;
  const pending = useQuery(
    api.social.myPendingRecommendations,
    viewerIsOwner ? {} : "skip",
  ) as PendingRec[] | undefined;
  const writeRec = useMutation(api.social.writeRecommendation);
  const decide = useMutation(api.social.decideRecommendation);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [relationship, setRelationship] = useState<string>("peer");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const charCount = body.trim().length;
  const canSubmit =
    !submitting && charCount >= 80 && charCount <= 3000 && !!relationship;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await writeRec({
        subjectUserId: profileUserId as unknown as never,
        relationship,
        body: body.trim(),
      });
      toast.success("Sent — awaiting approval");
      setDialogOpen(false);
      setBody("");
      setRelationship("peer");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not send recommendation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async (
    id: string,
    decision: "published" | "rejected",
  ) => {
    setDecidingId(id);
    try {
      await decide({
        recommendationId: id as unknown as never,
        decision,
      });
      toast.success(
        decision === "published" ? "Recommendation published" : "Declined",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <Card className="auf-card">
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 brand-fg" aria-hidden="true" />
            <h2 className="font-serif text-lg font-semibold">Recommendations</h2>
          </div>
          {!viewerIsOwner && signedIn && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger
                render={
                  <Button size="sm" variant="outline">
                    Write a recommendation
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Write a recommendation</DialogTitle>
                  <DialogDescription>
                    Recommendations are sent to the subject for approval before
                    they appear publicly. 80–3000 characters.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium ink-2">
                      Your relationship
                    </label>
                    <Select
                      value={relationship}
                      onValueChange={(v) => setRelationship(v ?? "peer")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium ink-2">
                      Recommendation
                    </label>
                    <Textarea
                      rows={6}
                      maxLength={3000}
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Share specifics about working with them — what they did, how, and the impact."
                    />
                    <div className="flex justify-between text-[11px] ink-3">
                      <span>
                        {charCount < 80
                          ? `${80 - charCount} more character${
                              80 - charCount === 1 ? "" : "s"
                            } needed`
                          : `${charCount} / 3000`}
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose
                    render={
                      <Button variant="ghost" disabled={submitting}>
                        Cancel
                      </Button>
                    }
                  />
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      "Send for approval"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Owner-only: pending approvals */}
        {viewerIsOwner && pending && pending.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide ink-2">
              Pending approval
            </h3>
            <ul className="space-y-3">
              {pending.map((p) => (
                <li
                  key={p._id}
                  className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-4"
                >
                  <RecHeader
                    name={p.authorName}
                    slug={p.authorSlug}
                    relationship={p.relationship}
                  />
                  <p className="mt-2 font-serif text-sm italic ink-2">
                    “{p.body}”
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={decidingId === p._id}
                      onClick={() => handleDecide(p._id, "published")}
                    >
                      {decidingId === p._id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={decidingId === p._id}
                      onClick={() => handleDecide(p._id, "rejected")}
                    >
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Published list */}
        {published === undefined ? (
          <p className="text-sm ink-3">Loading…</p>
        ) : published.length === 0 ? (
          <p className="text-sm ink-3">
            No recommendations yet.
            {!viewerIsOwner && signedIn && " Be the first to write one."}
          </p>
        ) : (
          <ul className="space-y-5">
            {published.map((r) => (
              <li key={r._id} className="border-l-2 border-border/60 pl-4">
                <RecHeader
                  name={r.authorName}
                  slug={r.authorSlug}
                  role={r.authorRole}
                  company={r.authorCompany}
                  relationship={r.relationship}
                />
                <blockquote className="mt-2 font-serif text-sm italic ink-2">
                  “{r.body}”
                </blockquote>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function RecHeader({
  name,
  slug,
  role,
  company,
  relationship,
}: {
  name: string;
  slug: string | null;
  role?: string | null;
  company?: string | null;
  relationship: string;
}) {
  const subtitle = [role, company].filter(Boolean).join(" · ");
  const relLabel =
    RELATIONSHIPS.find((r) => r.value === relationship)?.label ?? relationship;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <AUFAvatar name={name} size={36} grad={3} />
      <div className="min-w-0 flex-1">
        {slug ? (
          <Link
            href={`/u/${slug}`}
            className="text-sm font-semibold hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="text-sm font-semibold">{name}</span>
        )}
        {subtitle && <div className="text-xs ink-3">{subtitle}</div>}
      </div>
      <span className="auf-chip">{relLabel}</span>
    </div>
  );
}
