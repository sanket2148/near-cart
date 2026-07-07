import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSeller } from "@/lib/seller";
import { VerificationWizard } from "@/components/seller/VerificationWizard";

export const Route = createFileRoute("/seller/onboarding")({
  component: SellerOnboardingPage,
});

function SellerOnboardingPage() {
  const { verification, updateVerification } = useSeller();
  const navigate = useNavigate();

  return (
    <div className="py-2">
      <VerificationWizard
        initialVerification={verification}
        onCompleteAll={(updated) => {
          updateVerification(updated);
          navigate({ to: "/seller" });
        }}
        onBackToDashboard={() => {
          navigate({ to: "/seller" });
        }}
      />
    </div>
  );
}
