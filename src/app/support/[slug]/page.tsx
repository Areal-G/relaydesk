import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PortalTicketForm } from "@/components/portal/portal-forms";
import { PortalShell, PortalSkeleton } from "@/components/portal/portal-shell";
import { Card } from "@/components/ui/card";
import { getDb } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";
import { getPortalOrg } from "@/server/portal/service";

export const metadata: Metadata = { title: "Contact support" };

export default function SupportPortalPage({ params }: PageProps<"/support/[slug]">) {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <SupportPortal params={params} />
    </Suspense>
  );
}

async function SupportPortal({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  let org: Awaited<ReturnType<typeof getPortalOrg>>;
  try {
    org = await getPortalOrg(await getDb(), slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <PortalShell orgName={org.name}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">How can we help?</h1>
        <p className="mt-1 text-sm text-slate-500">
          Send a request to the {org.name} team. You&apos;ll get a private link to follow the conversation and reply.
        </p>
      </div>
      <Card className="p-5 sm:p-6">
        <PortalTicketForm slug={org.slug} />
      </Card>
    </PortalShell>
  );
}
