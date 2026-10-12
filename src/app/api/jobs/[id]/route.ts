import { after } from "next/server";
import { driveAndFlush, errorResponse, json, ready } from "@/lib/api";

export const maxDuration = 120;

export async function GET(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  try {
    const { id } = await ctx.params;
    const { engine } = await ready();
    const snapshot = engine.snapshot(id);
    if (!snapshot) return json({ error: { code: "not_found", message: `job ${id} not found` } }, 404);
    return json({ snapshot });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Resume/replay a job. Safe and idempotent: terminal jobs are unchanged, in-flight jobs continue from persisted state. */
export async function POST(_req: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  try {
    const { id } = await ctx.params;
    const { engine } = await ready();
    const snapshot = engine.snapshot(id);
    if (!snapshot) return json({ error: { code: "not_found", message: `job ${id} not found` } }, 404);
    after(() => driveAndFlush(id));
    return json({ resumed: true, snapshot });
  } catch (e) {
    return errorResponse(e);
  }
}
