import type { ReactNode } from "react";
import { PartnerHeader } from "./PartnerHeader";
import { PartnerBottomNav } from "./PartnerBottomNav";

export function PartnerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PartnerHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-4">{children}</main>
      <PartnerBottomNav />
    </div>
  );
}
