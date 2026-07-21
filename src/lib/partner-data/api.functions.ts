import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth-session/middleware";

// Every function below used to trust a client-supplied partnerId/assignmentId
// with zero verification — see plan/tasks/decisions.md, Phase 5 of the
// authorization-hardening plan. All identity is now derived from the
// verified session (context.uid) via authMiddleware; backend.server.ts
// resolves the caller's own delivery_partners row and verifies assignment
// ownership before any read/mutation.

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.getMyProfile(context.uid);
  });

export const createProfile = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({ name: z.string().min(1), vehicle: z.string().min(1), area: z.string().min(1) }),
  )
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.createProfile(context.uid, {
      name: data.name,
      vehicle: data.vehicle,
      area: data.area,
    });
  });

export const toggleOnline = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.toggleOnline(context.uid);
  });

export const getMyJobs = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const be = await import("./backend.server");
    return be.getMyJobs(context.uid);
  });

export const acceptJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ assignmentId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.acceptJob(data.assignmentId, context.uid);
  });

export const declineJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ assignmentId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.declineJob(data.assignmentId, context.uid);
  });

// currentStatus is no longer part of this request — it's derived from the
// assignment/order's real DB status inside advanceJob.
export const advanceJob = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ assignmentId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const be = await import("./backend.server");
    return be.advanceJob(data.assignmentId, context.uid);
  });
