import type { ReactNode } from "react";
import { SellerHeader } from "./SellerHeader";
import { SellerBottomNav } from "./SellerBottomNav";

export function SellerShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SellerHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-6 pt-4">{children}</main>
      <SellerBottomNav />
    </div>
  );
}
