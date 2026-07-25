import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Store } from "lucide-react";
import { SellerProvider, hasShop } from "@/lib/seller";
import { SellerShell } from "@/components/seller/SellerShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { CreateShopStep } from "@/components/seller/CreateShopStep";
import { ClaimShopStep } from "@/components/seller/ClaimShopStep";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/seller")({
  head: () => ({
    meta: [
      { title: "Seller Dashboard — NearCart" },
      {
        name: "description",
        content:
          "Manage your shop on NearCart — incoming orders, products, delivery partners and shop settings, all in one place.",
      },
    ],
  }),
  component: SellerLayout,
});

function SellerLayout() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"choose" | "claim" | "create">("choose");
  const { data: shopReady, isLoading } = useQuery({
    queryKey: ["has-shop", user?.id],
    queryFn: () => hasShop(),
    enabled: Boolean(user),
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-center text-xl font-extrabold">Seller login</h1>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Log in to manage your shop on NearCart.
          </p>
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!shopReady) {
    const onShopReady = (successMessage: string) => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ["has-shop", user.id] });
    };

    if (mode === "create") {
      return (
        <CreateShopStep
          onCreated={() => onShopReady("Shop created! Let's get it verified.")}
          onSwitchToClaim={() => setMode("claim")}
        />
      );
    }
    if (mode === "claim") {
      return (
        <ClaimShopStep
          onClaimed={() => onShopReady("Shop claimed! Let's get it verified.")}
          onSwitchToCreate={() => setMode("create")}
        />
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-extrabold">Is your shop already listed on NearCart?</h1>
          <p className="text-sm text-muted-foreground">
            We list real nearby shops automatically — yours might already be here.
          </p>
          <Button variant="hero" size="xl" className="w-full" onClick={() => setMode("claim")}>
            <Search className="h-4 w-4" /> Find and claim my shop
          </Button>
          <Button variant="outline" size="xl" className="w-full" onClick={() => setMode("create")}>
            <Store className="h-4 w-4" /> Create a new shop
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SellerProvider>
      <SellerShell>
        <Outlet />
      </SellerShell>
    </SellerProvider>
  );
}
