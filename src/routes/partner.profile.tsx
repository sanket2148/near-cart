import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Bike, Star, Phone, MapPin, Save } from "lucide-react";
import { usePartner } from "@/lib/partner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/partner/profile")({
  component: PartnerProfile,
});

function PartnerProfile() {
  const { profile, stats, updateProfile, toggleOnline } = usePartner();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [area, setArea] = useState(profile.area);
  const [vehicle, setVehicle] = useState(profile.vehicle);

  const handleSave = () => {
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    updateProfile({ name: name.trim(), phone: phone.trim(), area: area.trim(), vehicle });
    toast.success("Profile updated");
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-extrabold">Profile</h1>

      {/* Summary card */}
      <div className="rounded-2xl bg-gradient-primary p-5 text-primary-foreground shadow-float">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <Bike className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-extrabold leading-tight">{profile.name}</p>
            <p className="text-sm opacity-90">
              Partner since {profile.joinedAt} · {profile.vehicle}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-primary-foreground/10 p-2">
            <p className="flex items-center justify-center gap-1 text-base font-extrabold">
              <Star className="h-3.5 w-3.5" /> {profile.rating}
            </p>
            <p className="text-[11px] opacity-90">Rating</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-2">
            <p className="text-base font-extrabold">{stats.totalDeliveries}</p>
            <p className="text-[11px] opacity-90">Deliveries</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/10 p-2">
            <p className="text-base font-extrabold">{profile.online ? "On" : "Off"}</p>
            <p className="text-[11px] opacity-90">Status</p>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-card">
        <div>
          <p className="font-bold">Available for deliveries</p>
          <p className="text-xs text-muted-foreground">
            Turn off when you're taking a break.
          </p>
        </div>
        <Switch checked={profile.online} onCheckedChange={toggleOnline} />
      </div>

      {/* Edit form */}
      <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <h2 className="font-bold">Personal details</h2>

        <div className="space-y-1.5">
          <Label htmlFor="p-name">Full name</Label>
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-phone" className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5" /> Phone
          </Label>
          <Input id="p-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="p-area" className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" /> Service area
          </Label>
          <Input id="p-area" value={area} onChange={(e) => setArea(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label>Vehicle</Label>
          <Select value={vehicle} onValueChange={setVehicle}>
            <SelectTrigger>
              <SelectValue placeholder="Choose vehicle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Bike">Bike</SelectItem>
              <SelectItem value="Scooter">Scooter</SelectItem>
              <SelectItem value="Bicycle">Bicycle</SelectItem>
              <SelectItem value="On foot">On foot</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="hero" className="w-full" onClick={handleSave}>
          <Save className="h-4 w-4" /> Save changes
        </Button>
      </section>
    </div>
  );
}
