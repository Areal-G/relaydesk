"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { issueCustomerLinkAction, type CustomerLinkState } from "@/app/(app)/tickets/actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

/** Copy-to-clipboard row for a URL the user should share. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(event) => event.currentTarget.select()}
        className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 bg-slate-50 px-2 font-mono text-xs text-slate-700"
      />
      <Button
        size="sm"
        variant="secondary"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
          } catch {
            // Clipboard access can be denied (permissions, non-secure origin);
            // the field selects its text on focus, so the user can copy it by hand.
            return;
          }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

/**
 * Lets an agent issue the customer's private ticket link. Only a hash is
 * stored, so the link is shown once, right after it is generated.
 */
export function CustomerLinkPanel({ ticketId, appUrl, hasLink }: { ticketId: string; appUrl: string; hasLink: boolean }) {
  const [state, formAction, pending] = useActionState<CustomerLinkState, FormData>(
    issueCustomerLinkAction.bind(null, ticketId),
    {},
  );

  return (
    <div className="space-y-3 px-5 py-4">
      {state.token ? (
        <>
          <CopyField value={`${appUrl}/support/ticket/${state.token}`} label="Customer link" />
          <p className="text-xs text-slate-500">Send this to the customer. Any earlier link for this ticket no longer works.</p>
        </>
      ) : hasLink ? (
        <p className="text-xs text-slate-500">
          The customer already has a private link to read your replies and answer. Only make a new one if they&apos;ve
          lost it: their current link will stop working.
        </p>
      ) : (
        <p className="text-xs text-slate-500">
          The customer can read your replies and answer through a private link. Create one to send it to them.
        </p>
      )}
      <FormError message={state.error} />
      <form
        action={formAction}
        onSubmit={(event) => {
          if ((hasLink || state.token) && !window.confirm("Replace the customer's current link? The old one will stop working.")) {
            event.preventDefault();
          }
        }}
      >
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          <Link2 className="size-3.5" aria-hidden />
          {pending ? "Creating…" : hasLink || state.token ? "Replace link" : "Create customer link"}
        </Button>
      </form>
    </div>
  );
}
