import path from "path";

export interface SecurityIssue {
  line?: number;
  offset?: string;
  severity: "suspicious" | "critical";
  rule: string;
  description: string;
  matchedText: string;
}

export interface SecurityScanResult {
  fileName: string;
  scanned: boolean;
  status: "safe" | "warning" | "dangerous";
  issues: SecurityIssue[];
  autoDeleted: boolean;
  summary?: string;
}

// ----------------------------------------------------
// BATCH (.bat, .cmd) RULE DEFINITIONS
// ----------------------------------------------------

interface BatchRule {
  id: string;
  name: string;
  severity: "suspicious" | "critical";
  regex: RegExp;
  description: string;
}

const BATCH_RULES: BatchRule[] = [
  // === CRITICAL: VERY DANGEROUS (AUTOMATIC DELETE) ===
  {
    id: "DRIVE_FORMAT",
    name: "Hard Drive Format Command",
    severity: "critical",
    regex: /\bformat\s+[a-zA-Z]:/i,
    description: "Attempts to reformat an entire disk drive, destroying all data.",
  },
  {
    id: "SYSTEM_WIPE_DEL",
    name: "Destructive System File Deletion",
    severity: "critical",
    regex: /\b(del|erase)\s+.*(\/f|\/s|\/q).*([a-zA-Z]:\\|\%systemroot\%|\%windir\%|windows\\system32|\*)/i,
    description: "Forcefully and recursively deletes root or Windows system directories.",
  },
  {
    id: "SYSTEM_WIPE_RD",
    name: "Destructive Directory Removal",
    severity: "critical",
    regex: /\b(rd|rmdir)\s+.*\/s.*(\/q)?.*([a-zA-Z]:\\|\%systemroot\%|\%windir\%|windows)/i,
    description: "Forcefully wipes entire drive root or core operating system directory.",
  },
  {
    id: "FORK_BOMB",
    name: "Fork Bomb Crash Loop",
    severity: "critical",
    regex: /(\%0\s*\|\s*\%0|:([a-zA-Z0-9_]+)\s+start\s+.*goto\s+\2)/i,
    description: "Spawns infinite processes recursively to freeze or crash the host machine.",
  },
  {
    id: "DISABLE_DEFENDER",
    name: "Disable Windows Antivirus / Defender",
    severity: "critical",
    regex: /(Set-MpPreference.*-DisableRealtimeMonitoring.*\$true|sc\s+(stop|config|delete)\s+WinDefend|net\s+stop\s+(WinDefend|MpsSvc))/i,
    description: "Attempts to shut down or disable Windows Defender real-time protection.",
  },
  {
    id: "DELETE_SHADOW_COPIES",
    name: "Volume Shadow Copy Wipe (Ransomware Tactic)",
    severity: "critical",
    regex: /(vssadmin\s+delete\s+shadows|wmic\s+shadowcopy\s+delete|wbadmin\s+delete\s+catalog|bcdedit\s+\/set.*recoveryenabled\s+no)/i,
    description: "Destroys Windows system recovery restore points and volume shadow copies.",
  },

  // === SUSPICIOUS (WARNING ONLY - DO NOT AUTOMATICALLY DELETE) ===
  {
    id: "REMOTE_DOWNLOAD_CURL",
    name: "External File Download",
    severity: "suspicious",
    regex: /\b(curl|wget|bitsadmin|certutil)\s+.*(https?:\/\/)/i,
    description: "Downloads an external file from the internet via command line.",
  },
  {
    id: "POWERSHELL_DOWNLOAD",
    name: "PowerShell Web Download",
    severity: "suspicious",
    regex: /powershell.*(DownloadFile|DownloadString|Invoke-WebRequest|iwr|Net\.WebClient)/i,
    description: "Uses PowerShell to download payloads or execute code from an external URL.",
  },
  {
    id: "POWERSHELL_ENCODED",
    name: "PowerShell Encoded/Hidden Execution",
    severity: "suspicious",
    regex: /powershell.*(-e|-enc|-encodedcommand|-windowstyle\s+hidden|-executionpolicy\s+bypass)/i,
    description: "Executes hidden or base64-encoded PowerShell commands with policy bypass.",
  },
  {
    id: "REGISTRY_MOD",
    name: "Windows Registry Modification",
    severity: "suspicious",
    regex: /\breg\s+(add|delete|import)\s+.*(run|runonce|services|policies|currenversion)/i,
    description: "Modifies Windows Registry startup keys, system services, or security policies.",
  },
  {
    id: "TASKKILL_FORCE",
    name: "Force Kill Process",
    severity: "suspicious",
    regex: /\btaskkill\s+.*\/f\s+.*(\/im|\/pid)/i,
    description: "Forcefully terminates running system or application processes.",
  },
  {
    id: "SCHTASKS_PERSIST",
    name: "Scheduled Task Creation",
    severity: "suspicious",
    regex: /\bschtasks\s+\/create\s+/i,
    description: "Creates scheduled background tasks for persistence.",
  },
  {
    id: "DISABLE_FIREWALL",
    name: "Firewall Modification",
    severity: "suspicious",
    regex: /netsh\s+advfirewall\s+set.*state\s+off/i,
    description: "Disables the local Windows Defender firewall.",
  },
  {
    id: "NET_USER_ADMIN",
    name: "User Account & Privilege Escalation",
    severity: "suspicious",
    regex: /\bnet\s+(user\s+.*\/add|localgroup\s+administrators\s+.*\/add)/i,
    description: "Creates a new user account or elevates accounts to local administrator.",
  },
  {
    id: "FORCE_SHUTDOWN",
    name: "Force System Shutdown / Reboot",
    severity: "suspicious",
    regex: /\bshutdown\s+.*(\/s|\/r|\-s|\-r)/i,
    description: "Initiates an automated or forced system shutdown or reboot.",
  },
  {
    id: "SCRIPT_PROXY_EXEC",
    name: "Script Proxy Binary Execution (LOLBIN)",
    severity: "suspicious",
    regex: /\b(mshta|rundll32|regsvr32|cscript|wscript)\b.*(http|javascript|vbscript|\.dll)/i,
    description: "Executes scripts or DLLs via system proxy binaries often abused to bypass controls.",
  },
  {
    id: "PERMISSION_TAMPER",
    name: "Access Control / Ownership Tampering",
    severity: "suspicious",
    regex: /\b(takeown\s+\/f|icacls\s+.*(\/grant|\/deny))/i,
    description: "Attempts to seize ownership or alter permissions on system or protected files.",
  },
  {
    id: "ATTRIB_STEALTH",
    name: "File Stealth Attribute Manipulation",
    severity: "suspicious",
    regex: /\battrib\s+.*(\+h|\+s)/i,
    description: "Hides files by setting hidden or system attributes.",
  },
];

// ----------------------------------------------------
// PE BINARY (.exe) SIGNATURE RULES
// ----------------------------------------------------

interface ExeRule {
  id: string;
  name: string;
  severity: "suspicious" | "critical";
  pattern: Buffer | string;
  description: string;
}

const EXE_RULES: ExeRule[] = [
  // Critical signatures inside .exe
  {
    id: "EXE_VSSADMIN_WIPE",
    name: "Embedded Shadow Copy Deletion",
    severity: "critical",
    pattern: "vssadmin delete shadows",
    description: "Contains embedded commands to destroy system recovery points (ransomware behavior).",
  },
  {
    id: "EXE_FORMAT_COMMAND",
    name: "Embedded Drive Format Command",
    severity: "critical",
    pattern: "format c: /y",
    description: "Contains embedded strings instructing drive format operations.",
  },

  // Suspicious signatures inside .exe
  {
    id: "EXE_PROCESS_HOLLOWING",
    name: "Process Injection / Memory Modification APIs",
    severity: "suspicious",
    pattern: "WriteProcessMemory",
    description: "Imports or references APIs commonly used to inject code into other processes.",
  },
  {
    id: "EXE_REMOTE_THREAD",
    name: "Remote Thread Execution API",
    severity: "suspicious",
    pattern: "CreateRemoteThread",
    description: "Imports CreateRemoteThread for cross-process execution.",
  },
  {
    id: "EXE_URL_DOWNLOAD",
    name: "Direct URL Download API",
    severity: "suspicious",
    pattern: "URLDownloadToFile",
    description: "Imports Windows dropper API to fetch files from remote servers.",
  },
  {
    id: "EXE_REG_PERSISTENCE",
    name: "Registry Run Key Persistence",
    severity: "suspicious",
    pattern: "CurrentVersion\\Run",
    description: "References startup autorun registry keys.",
  },
  {
    id: "EXE_MEM_ALLOC",
    name: "Remote Memory Allocation API",
    severity: "suspicious",
    pattern: "VirtualAllocEx",
    description: "Imports VirtualAllocEx often associated with memory payload staging.",
  },
  {
    id: "EXE_KEYHOOK",
    name: "System Event / Keyboard Hooking API",
    severity: "suspicious",
    pattern: "SetWindowsHookEx",
    description: "Imports SetWindowsHookEx commonly used for global keylogging or event interception.",
  },
];

/**
 * Scans a .bat, .cmd, or text script line by line.
 */
function scanBatchScript(fileName: string, content: string): SecurityScanResult {
  const lines = content.split(/\r?\n/);
  const issues: SecurityIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const trimmed = rawLine.trim();

    // Skip blank lines and comments (:: or rem)
    if (!trimmed || trimmed.startsWith("::") || /^rem\b/i.test(trimmed)) {
      continue;
    }

    for (const rule of BATCH_RULES) {
      if (rule.regex.test(trimmed)) {
        issues.push({
          line: lineNum,
          severity: rule.severity,
          rule: rule.name,
          description: rule.description,
          matchedText: rawLine.trim(),
        });
      }
    }
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasSuspicious = issues.some((i) => i.severity === "suspicious");

  if (hasCritical) {
    return {
      fileName,
      scanned: true,
      status: "dangerous",
      issues,
      autoDeleted: true,
      summary: `File contained ${issues.filter((i) => i.severity === "critical").length} very dangerous instruction(s) and was automatically blocked and deleted.`,
    };
  }

  if (hasSuspicious) {
    return {
      fileName,
      scanned: true,
      status: "warning",
      issues,
      autoDeleted: false,
      summary: `File contained ${issues.length} suspicious line(s). Uploaded with warnings.`,
    };
  }

  return {
    fileName,
    scanned: true,
    status: "safe",
    issues: [],
    autoDeleted: false,
  };
}

/**
 * Scans a PE .exe binary by inspecting strings and headers.
 */
function scanExeBinary(fileName: string, buffer: Buffer): SecurityScanResult {
  const issues: SecurityIssue[] = [];

  // Check MZ header (0x5A4D)
  const isPE = buffer.length > 2 && buffer[0] === 0x4d && buffer[1] === 0x5a;
  if (!isPE) {
    return {
      fileName,
      scanned: true,
      status: "safe",
      issues: [],
      autoDeleted: false,
    };
  }

  for (const rule of EXE_RULES) {
    const searchBuf = Buffer.from(rule.pattern as string, "utf-8");
    const idx = buffer.indexOf(searchBuf);

    if (idx !== -1) {
      const hexOffset = "0x" + idx.toString(16).toUpperCase().padStart(6, "0");
      issues.push({
        offset: hexOffset,
        severity: rule.severity,
        rule: rule.name,
        description: rule.description,
        matchedText: `Found at offset ${hexOffset}: "${rule.pattern}"`,
      });
    }
  }

  const hasCritical = issues.some((i) => i.severity === "critical");
  const hasSuspicious = issues.some((i) => i.severity === "suspicious");

  if (hasCritical) {
    return {
      fileName,
      scanned: true,
      status: "dangerous",
      issues,
      autoDeleted: true,
      summary: `Executable contains very dangerous destructive payload strings and was automatically blocked and deleted.`,
    };
  }

  if (hasSuspicious) {
    return {
      fileName,
      scanned: true,
      status: "warning",
      issues,
      autoDeleted: false,
      summary: `Executable contains ${issues.length} suspicious API/behavior indicator(s). Uploaded with warnings.`,
    };
  }

  return {
    fileName,
    scanned: true,
    status: "safe",
    issues: [],
    autoDeleted: false,
  };
}

/**
 * Main entry point: scans files for security threats.
 */
export function scanFileSecurity(fileName: string, buffer: Buffer): SecurityScanResult {
  const ext = path.extname(fileName).toLowerCase();

  // 1. Batch & Script files
  if (ext === ".bat" || ext === ".cmd" || ext === ".ps1" || ext === ".vbs") {
    const content = buffer.toString("utf-8");
    return scanBatchScript(fileName, content);
  }

  // 2. Executables & Binaries
  if (ext === ".exe" || ext === ".dll" || ext === ".scr" || ext === ".com") {
    return scanExeBinary(fileName, buffer);
  }

  return {
    fileName,
    scanned: false,
    status: "safe",
    issues: [],
    autoDeleted: false,
  };
}
