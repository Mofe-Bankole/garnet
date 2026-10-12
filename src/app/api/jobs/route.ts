import { after } from "next/server";
import { driveAndFlush, errorResponse, json, ready } from "@/lib/api";

export const maxDuration = 120;

/** Create a job (idempotent by `idempotencyKey`) and drive it in the background. Poll GET /api/jobs/:id. */
export async function POST(request: Request) {
  try {
    const { engine } = await ready();
    const body = await request.json();
    const { job, created } = engine.createJob({
      txHash: String(body?.txHash ?? "").trim(),
      budget: String(body?.budget ?? "").trim(),
      injectSellerAFault: body?.injectSellerAFault === true,
      idempotencyKey: typeof body?.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    });
    after(() => driveAndFlush(job.id));
    return json({ created, snapshot: engine.snapshot(job.id) }, created ? 201 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}

export async function GET() {
  try {
    const { engine } = await ready();
    const jobs = engine.repo.listJobs(10).map((j) => ({
      id: j.id,
      status: j.status,
      stage: j.stage,
      planner: j.planner,
      faultInjection: !!j.fault_injection,
      traceId: j.trace_id,
      createdAt: j.created_at,
      outcome: j.outcome_json ? JSON.parse(j.outcome_json) : null,
    }));
    return json({ jobs });
  } catch (e) {
    return errorResponse(e);
  }
}
