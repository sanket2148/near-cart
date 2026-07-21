import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SellerProvider, hasShop } from "@/lib/seller";
import { SellerShell } from "@/components/seller/SellerShell";
import { EmailOtpAuth } from "@/components/EmailOtpAuth";
import { CreateShopStep } from "@/components/seller/CreateShopStep";
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
          <EmailOtpAuth onSuccess={() => toast.success("Logged in!")} />
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
    return (
      <CreateShopStep
        onCreated={() => {
          toast.success("Shop created! Let's get it verified.");
          queryClient.invalidateQueries({ queryKey: ["has-shop", user.id] });
        }}
      />
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
