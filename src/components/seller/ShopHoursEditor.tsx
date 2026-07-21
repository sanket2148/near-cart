import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getShopHours, setShopHours, type ShopHourEntry } from "@/lib/shop-hours/api.functions";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "21:00";

type DayRow = { closed: boolean; openTime: string; closeTime: string };

export function ShopHoursEditor({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const { data: hours, isLoading } = useQuery({
    queryKey: ["shop-hours", shopId],
    queryFn: () => getShopHours({ data: { shopId } }),
  });
  const [rows, setRows] = useState<DayRow[]>(
    Array.from({ length: 7 }, () => ({
      closed: true,
      openTime: DEFAULT_OPEN,
      closeTime: DEFAULT_CLOSE,
    })),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hours) return;
    const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));
    setRows(
      Array.from({ length: 7 }, (_, day) => {
        const entry = byDay.get(day);
        return entry
          ? { closed: false, openTime: entry.openTime, closeTime: entry.closeTime }
          : { closed: true, openTime: DEFAULT_OPEN, closeTime: DEFAULT_CLOSE };
      }),
    );
  }, [hours]);

  function updateRow(day: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r, i) => (i === day ? { ...r, ...patch } : r)));
  }

  async function save() {
    setSaving(true);
    try {
      const entries: ShopHourEntry[] = rows
        .map((r, day) => ({
          dayOfWeek: day,
          openTime: r.openTime,
          closeTime: r.closeTime,
          closed: r.closed,
        }))
        .filter((r) => !r.closed)
        .map(({ dayOfWeek, openTime, closeTime }) => ({ dayOfWeek, openTime, closeTime }));
      await setShopHours({ data: { shopId, hours: entries } });
      await queryClient.invalidateQueries({ queryKey: ["shop-hours", shopId] });
      toast.success("Hours saved — customers now see your real schedule.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save hours.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-2 font-bold">
        <Clock className="h-4 w-4 text-primary" /> Weekly hours
      </h2>
      <p className="text-xs text-muted-foreground">
        Set real hours and customers will see exactly when you're open — instead of you having to
        remember to flip the toggle above.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row, day) => (
            <div key={day} className="flex items-center gap-2">
              <span className="w-9 shrink-0 text-xs font-bold">{DAY_LABELS[day]}</span>
              <Switch
                checked={!row.closed}
                onCheckedChange={(checked) => updateRow(day, { closed: !checked })}
              />
              {row.closed ? (
                <span className="flex-1 text-xs text-muted-foreground">Closed</span>
              ) : (
                <div className="flex flex-1 items-center gap-1.5">
                  <input
                    type="time"
                    value={row.openTime}
                    onChange={(e) => updateRow(day, { openTime: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">–</span>
                  <input
                    type="time"
                    value={row.closeTime}
                    onChange={(e) => updateRow(day, { closeTime: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-2 py-1 text-xs"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button variant="hero" className="w-full" onClick={save} disabled={saving || isLoading}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save hours"}
      </Button>
    </section>
  );
}
