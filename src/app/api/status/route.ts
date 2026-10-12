import { connection } from "next/server";
import { json, ready, systemStatus } from "@/lib/api";

export async function GET() {
  await connection();
  await ready();
  return json(systemStatus());
}
