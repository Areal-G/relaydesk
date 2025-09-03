"use client";

import { useActionState } from "react";
import { customerReplyAction, submitPortalTicketAction } from "@/app/support/actions";
import { Button } from "@/components/ui/button";
import { FormError, Input, Label, Textarea } from "@/components/ui/form";
import { type ActionState, idleState } from "@/lib/action-state";

export function PortalTicketForm({ slug }: { slug: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitPortalTicketAction.bind(null, slug),
    idleState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
      </div>
      <div>
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" placeholder="What do you need help with?" minLength={3} required />
      </div>
      <div>
        <Label htmlFor="description">Details</Label>
        <Textarea
          id="description"
          name="description"
          rows={6}
          placeholder="Include links, steps to reproduce and anything you've already tried."
          required
        />
      </div>
      {/* Honeypot for bots: hidden from people and assistive tech. */}
      <div aria-hidden className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.status === "error" ? <FormError message={state.error} /> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}

export function CustomerReplyForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    customerReplyAction.bind(null, token),
    idleState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <Textarea name="body" rows={4} required placeholder="Write a reply…" aria-label="Reply" />
      {state.status === "error" ? <FormError message={state.error} /> : null}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">
          {state.status === "success" ? "Reply sent. The team will see it in their queue." : "Your reply goes to the support team."}
        </span>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
