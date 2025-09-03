import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CheckCircle2 } from "lucide-react";
import { CustomerReplyForm } from "@/components/portal/portal-forms";
import { PortalShell, PortalSkeleton } from "@/components/portal/portal-shell";
import { StatusBadge } from "@/components/tickets/badges";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getDb } from "@/server/db/client";
import { NotFoundError } from "@/server/errors";
import { type CustomerTicketView, getCustomerTicket } from "@/server/portal/service";

// Private link: keep it out of search engines.
export const metadata: Metadata = { title: "Your support request", robots: { index: false, follow: false } };

export default function CustomerTicketPage({ params, searchParams }: PageProps<"/support/ticket/[token]">) {
  return (
    <Suspense fallback={<PortalSkeleton />}>
      <CustomerTicket params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerTicket({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Per-request page: live conversation data and relative times, never prerendered.
  await connection();
  const [{ token }, query] = await Promise.all([params, searchParams]);
  let view: CustomerTicketView;
  try {
    view = await getCustomerTicket(await getDb(), token);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const { ticket, replies } = view;
  const now = new Date();

  return (
    <PortalShell orgName={ticket.orgName}>
      {query.new === "1" ? (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Thanks, your request #{ticket.number} has been sent. <strong>Bookmark this page</strong>: it&apos;s your
            private link to follow replies and respond.
          </p>
        </div>
      ) : null}

      <div>
        <p className="font-mono text-sm text-slate-400">#{ticket.number}</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{ticket.subject}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
          <StatusBadge status={ticket.status} />
          <span>Opened {formatRelative(ticket.createdAt, now)}</span>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <Avatar name={ticket.requesterName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-slate-900">{ticket.requesterName}</p>
              <time className="text-xs text-slate-400" dateTime={new Date(ticket.createdAt).toISOString()}>
                {formatDateTime(ticket.createdAt)}
              </time>
            </div>
            <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-700">{ticket.description}</p>
          </div>
        </div>
      </Card>

      <section aria-label="Conversation" className="space-y-3">
        {replies.map((reply) => (
          <article
            key={reply.id}
            className={cn(
              "rounded-xl border p-4",
              reply.fromCustomer ? "border-slate-200 bg-white" : "border-brand-100 bg-brand-50/40",
            )}
          >
            <header className="flex flex-wrap items-center gap-2">
              <Avatar name={reply.authorName} size="sm" />
              <span className="text-sm font-medium text-slate-900">{reply.authorName}</span>
              {reply.fromCustomer ? <Badge>You</Badge> : <Badge tone="brand">{ticket.orgName}</Badge>}
              <time className="ml-auto text-xs text-slate-400" dateTime={new Date(reply.createdAt).toISOString()}>
                {formatRelative(reply.createdAt, now)}
              </time>
            </header>
            <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-700">{reply.body}</p>
          </article>
        ))}
      </section>

      <Card className="p-5">
        <CustomerReplyForm token={token} />
      </Card>
    </PortalShell>
  );
}
