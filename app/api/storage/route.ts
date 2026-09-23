import { getDiskUsage, formatBytes } from "@/lib/storage";
import { headers } from "next/headers";

export async function GET() {
  // Access headers to ensure this route is always dynamic
  await headers();
  try {
    const usage = getDiskUsage();
    return Response.json({
      total: usage.total,
      used: usage.used,
      free: usage.free,
      percent: usage.percent,
      totalFormatted: formatBytes(usage.total),
      usedFormatted: formatBytes(usage.used),
      freeFormatted: formatBytes(usage.free),
    });
  } catch {
    return Response.json(
      { error: "Failed to get storage info" },
      { status: 500 }
    );
  }
}
