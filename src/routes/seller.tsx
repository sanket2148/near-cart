import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SellerProvider } from "@/lib/seller";
import { SellerShell } from "@/components/seller/SellerShell";

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
  return (
    <SellerProvider>
      <SellerShell>
        <Outlet />
      </SellerShell>
    </SellerProvider>
  );
}
