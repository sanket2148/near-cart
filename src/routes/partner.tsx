import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PartnerProvider, hasProfile } from "@/lib/partner";
import { PartnerShell } from "@/components/partner/PartnerShell";
import { EmailOtpAuth } from "@/components/EmailOtpAuth";
import { CreatePartnerProfile } from "@/components/partner/CreatePartnerProfile";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/partner")({
  head: () => ({
    meta: [
      { title: "Delivery Partner — NearCart" },
      {
        name: "description",
        content:
          "NearCart delivery partner app — accept delivery requests, navigate pickups and drop-offs, and track your daily earnings.",
      },
    ],
  }),
  component: PartnerLayout,
});

function PartnerLayout() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { data: profileReady, isLoading } = useQuery({
    queryKey: ["has-partner-profile", user?.id],
    queryFn: () => hasProfile(),
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
          <h1 className="mb-1 text-center text-xl font-extrabold">Delivery partner login</h1>
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Log in to go online and start accepting deliveries.
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

  if (!profileReady) {
    return (
      <CreatePartnerProfile
        onCreated={() => {
          toast.success("You're all set!");
          queryClient.invalidateQueries({ queryKey: ["has-partner-profile", user.id] });
        }}
      />
    );
  }

  return (
    <PartnerProvider>
      <PartnerShell>
        <Outlet />
      </PartnerShell>
    </PartnerProvider>
  );
}
