"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Input, Label } from "@/components/ui/form";
import { type SignupState, signupAction } from "./actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signupAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" autoComplete="name" defaultValue={state.values?.name} placeholder="Sam Taylor" required />
      </div>
      <div>
        <Label htmlFor="email">Work email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.values?.email}
          placeholder="you@agency.com"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <div>
        <Label htmlFor="orgName">Agency name</Label>
        <Input
          id="orgName"
          name="orgName"
          autoComplete="organization"
          defaultValue={state.values?.orgName}
          placeholder="Brightside Studio"
          required
        />
        <p className="mt-1 text-xs text-slate-500">Your clients will see this on your support portal.</p>
      </div>
      <FormError message={state.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your workspace…" : "Create workspace"}
      </Button>
    </form>
  );
}
