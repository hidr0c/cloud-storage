import { headers } from "next/headers";
import os from "os";

export async function GET() {
  await headers();
  try {
    const uptime = os.uptime();
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    // CPU usage: average across all cores
    const cpuCount = cpus.length;
    let cpuModel = cpus[0]?.model || "Unknown";
    // Clean up CPU model name
    cpuModel = cpuModel.replace(/\s+/g, " ").trim();

    // Calculate average CPU speed
    const avgSpeed = Math.round(
      cpus.reduce((sum, c) => sum + c.speed, 0) / cpuCount
    );

    // Network interfaces
    const nets = os.networkInterfaces();
    const addresses: { name: string; address: string; family: string }[] = [];
    for (const [name, ifaces] of Object.entries(nets)) {
      if (!ifaces) continue;
      for (const iface of ifaces) {
        if (!iface.internal && iface.family === "IPv4") {
          addresses.push({ name, address: iface.address, family: "IPv4" });
        }
      }
    }

    // Format uptime
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const uptimeStr =
      (days > 0 ? `${days}d ` : "") +
      `${hours}h ${minutes}m`;

    // Server time in GMT+7
    const serverTime = new Date().toLocaleString("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return Response.json({
      status: "online",
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      cpuModel,
      cpuCores: cpuCount,
      cpuSpeed: `${avgSpeed} MHz`,
      memTotal: totalMem,
      memUsed: usedMem,
      memFree: freeMem,
      memPercent,
      memTotalFormatted: formatBytes(totalMem),
      memUsedFormatted: formatBytes(usedMem),
      memFreeFormatted: formatBytes(freeMem),
      uptime: uptimeStr,
      uptimeSeconds: uptime,
      serverTime,
      networkInterfaces: addresses,
    });
  } catch {
    return Response.json(
      { status: "error", error: "Failed to get server status" },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
