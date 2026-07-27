import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Star, Trash2, Pencil, LocateFixed } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { EmailPasswordAuth } from "@/components/EmailPasswordAuth";
import { useAuth } from "@/lib/auth";
import { useLocation } from "@/lib/location";
import {
  listAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type Address,
} from "@/lib/addresses/api.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/addresses")({
  head: () => ({ meta: [{ title: "Saved Addresses — NearCart" }] }),
  component: AddressesPage,
});

type FormState = {
  id?: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  pincode: string;
  lat: number | null;
  lng: number | null;
};

const EMPTY_FORM: FormState = {
  label: "",
  line1: "",
  line2: "",
  city: "",
  pincode: "",
  lat: null,
  lng: null,
};

function AddressesPage() {
  const { user, loading: authLoading } = useAuth();
  const { state: locationState } = useLocation();
  const queryClient = useQueryClient();

  const { data: addresses = [], isLoading } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: () => listAddresses(),
    enabled: Boolean(user),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function openAdd() {
    setForm({
      ...EMPTY_FORM,
      lat: locationState.coords?.lat ?? null,
      lng: locationState.coords?.lng ?? null,
    });
    setDialogOpen(true);
  }

  function openEdit(addr: Address) {
    setForm({
      id: addr.id,
      label: addr.label ?? "",
      line1: addr.line1,
      line2: addr.line2 ?? "",
      city: addr.city,
      pincode: addr.pincode,
      lat: addr.lat,
      lng: addr.lng,
    });
    setDialogOpen(true);
  }

  function useMyLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      toast.error("Location isn't supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set("lat", pos.coords.latitude);
        set("lng", pos.coords.longitude);
        setLocating(false);
        toast.success("Pinned your current location");
      },
      (err) => {
        setLocating(false);
        toast.error(err.message || "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function save() {
    if (!form.line1.trim() || !form.city.trim() || !form.pincode.trim()) {
      toast.error("Address line, city, and pincode are required.");
      return;
    }
    if (form.lat === null || form.lng === null) {
      toast.error('Add a map pin — tap "Use my current location".');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: form.label.trim() || undefined,
        line1: form.line1.trim(),
        line2: form.line2.trim() || undefined,
        city: form.city.trim(),
        pincode: form.pincode.trim(),
        lat: form.lat,
        lng: form.lng,
      };
      if (form.id) {
        await updateAddress({ data: { ...payload, id: form.id } });
      } else {
        await addAddress({ data: payload });
      }
      await queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      setDialogOpen(false);
      toast.success(form.id ? "Address updated" : "Address added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save this address.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteAddress({ data: { id: deleteId } });
      await queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
      toast.success("Address removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove this address.");
    } finally {
      setDeleteId(null);
    }
  }

  async function makeDefault(id: string) {
    try {
      await setDefaultAddress({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["addresses", user?.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update default address.");
    }
  }

  if (authLoading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell hideNav>
        <h1 className="text-xl font-extrabold">Saved Addresses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to manage your delivery addresses.
        </p>
        <div className="mt-4">
          <EmailPasswordAuth onSuccess={() => toast.success("Logged in!")} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">Saved Addresses</h1>
        <Button size="sm" variant="hero" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add new
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : addresses.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-5xl">📍</p>
          <h2 className="mt-4 text-lg font-bold">No saved addresses yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add one to speed up checkout next time.
          </p>
          <Button variant="hero" size="lg" className="mt-6" onClick={openAdd}>
            <Plus className="h-4 w-4" /> Add an address
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MapPin className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold">{addr.label || "Address"}</p>
                      {addr.isDefault && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {addr.line1}
                      {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city} — {addr.pincode}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                {!addr.isDefault && (
                  <Button size="sm" variant="outline" onClick={() => makeDefault(addr.id)}>
                    <Star className="h-3.5 w-3.5" /> Set default
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => openEdit(addr)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteId(addr.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit address" : "Add address"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="addr-label">Label (optional)</Label>
              <Input
                id="addr-label"
                placeholder="Home, Work, ..."
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-line1">Address line</Label>
              <Input
                id="addr-line1"
                placeholder="House / flat, street"
                value={form.line1}
                onChange={(e) => set("line1", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-line2">Landmark (optional)</Label>
              <Input
                id="addr-line2"
                value={form.line2}
                onChange={(e) => set("line2", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="addr-city">City</Label>
                <Input
                  id="addr-city"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="addr-pincode">Pincode</Label>
                <Input
                  id="addr-pincode"
                  value={form.pincode}
                  onChange={(e) => set("pincode", e.target.value)}
                />
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={useMyLocation}
              disabled={locating}
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LocateFixed className="h-4 w-4" />{" "}
                  {form.lat !== null ? "Pin updated — tap to refresh" : "Use my current location"}
                </>
              )}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="hero" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save address"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this address?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
