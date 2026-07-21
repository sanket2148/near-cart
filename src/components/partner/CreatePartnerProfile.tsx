import { useState } from "react";
import { ArrowRight, Bike, Car, Truck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createProfile, type RiderProfile } from "@/lib/partner";
import { knownAreas } from "@/lib/location";

const VEHICLES = [
  { id: "Bike", label: "Bike", icon: Bike },
  { id: "Scooter", label: "Scooter", icon: Bike },
  { id: "Car", label: "Car", icon: Car },
  { id: "Van", label: "Van", icon: Truck },
] as const;

type Props = {
  onCreated: (profile: RiderProfile) => void;
};

export function CreatePartnerProfile({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [area, setArea] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 1 && vehicle !== "" && area.trim().length > 1;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const profile = await createProfile({
        name: name.trim(),
        vehicle,
        area: area.trim(),
      });
      onCreated(profile);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not register. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-extrabold">Become a delivery partner</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A few basics before you go online and start accepting deliveries.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="partner-name">Your name</Label>
          <Input
            id="partner-name"
            placeholder="e.g. Arjun Kumar"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Vehicle</Label>
          <div className="grid grid-cols-4 gap-2">
            {VEHICLES.map((v) => {
              const isSelected = vehicle === v.id;
              return (
                <button
                  type="button"
                  key={v.id}
                  onClick={() => setVehicle(v.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-float"
                      : "border-border bg-card shadow-card hover:border-primary/40",
                  )}
                >
                  <v.icon
                    className={cn("h-5 w-5", isSelected ? "text-primary" : "text-muted-foreground")}
                  />
                  <span className="text-[11px] font-bold">{v.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="partner-area">Preferred zone</Label>
          <Input
            id="partner-area"
            list="known-areas"
            placeholder="e.g. Koramangala"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          />
          <datalist id="known-areas">
            {knownAreas().map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>

        <Button
          variant="hero"
          size="xl"
          className="w-full"
          disabled={!canSubmit || submitting}
          onClick={submit}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Start delivering <ArrowRight className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
