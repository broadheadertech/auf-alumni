"use client";

import Link from "next/link";
import { Briefcase, Users, Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function EmployerDashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Employer dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Post jobs to verified AUF graduates. Track applicants in your pipeline.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <NavCard
          icon={Briefcase}
          title="Jobs"
          description="Post and manage job listings"
          href="/employer/jobs"
        />
        <NavCard
          icon={Users}
          title="Applicants"
          description="Track candidates through your pipeline"
          href="/employer/applicants"
        />
        <NavCard
          icon={Receipt}
          title="Billing"
          description="Plan, quota, and history"
          href="/employer/billing"
        />
      </div>
    </div>
  );
}

function NavCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card className="transition-colors hover:border-foreground/40">
        <CardContent className="p-5">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <h2 className="mt-3 font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
