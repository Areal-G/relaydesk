import type { ReactNode } from "react";
import { Bot, Globe, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const highlights = [
  { icon: ShieldCheck, title: "Role-based access", body: "Owners, admins, agents and viewers, isolated per organization." },
  { icon: Globe, title: "Client support portal", body: "Clients open tickets and follow replies from your own portal page." },
  { icon: Bot, title: "AI assist", body: "Summarise long threads and draft replies, streamed in real time." },
];

/** Two-column layout shared by the sign-in and sign-up pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-slate-950 p-12 text-slate-300 lg:flex">
        <Logo inverted />
        <div className="max-w-md space-y-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            The client-support desk built for agencies.
          </h1>
          <ul className="space-y-5">
            {highlights.map(({ icon: Icon, title: heading, body }) => (
              <li key={heading} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-brand-500" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-white">{heading}</p>
                  <p className="text-sm text-slate-400">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Relaydesk · support for agencies and their clients.</p>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
