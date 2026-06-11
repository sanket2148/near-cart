import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PartnerProvider } from "@/lib/partner";
import { PartnerShell } from "@/components/partner/PartnerShell";

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
  return (
    <PartnerProvider>
      <PartnerShell>
        <Outlet />
      </PartnerShell>
    </PartnerProvider>
  );
}
