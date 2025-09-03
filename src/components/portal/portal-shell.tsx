import type { ReactNode } from "react";
import { LifeBuoy } from "lucide-react";

/** Public page frame for an organization's support portal. */
export function PortalShell({ orgName, children }: { orgName: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm">
            <LifeBuoy className="size-4.5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">{orgName}</p>
            <p className="text-xs text-slate-500">Support</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8 sm:px-6">{children}</main>
      <footer className="py-6 text-center text-xs text-slate-400">Powered by Relaydesk</footer>
    </div>
  );
}

export function PortalSkeleton() {
  return (
    <div aria-busy className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-12 sm:px-6">
      <div className="h-6 w-56 rounded bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-100" />
    </div>
  );
}
