"use client";

import { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import type { SecurityScanResult, SecurityIssue } from "@/lib/securityScanner";
import type { SharePublicInfo } from "@/lib/share";

// ---- Types ----
interface FileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: string;
}

interface StorageInfo {
  total: number;
  used: number;
  free: number;
  percent: number;
  totalFormatted: string;
  usedFormatted: string;
  freeFormatted: string;
}

interface ServerStatus {
  status: string;
  hostname: string;
  platform: string;
  cpuModel: string;
  cpuCores: number;
  cpuSpeed: string;
  memPercent: number;
  memUsedFormatted: string;
  memTotalFormatted: string;
  uptime: string;
  serverTime: string;
  networkInterfaces: { name: string; address: string }[];
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  speed: string;
  status: "uploading" | "done" | "error";
}

// ---- Helpers ----
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileExtension(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return "0 B/s";
  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
  return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ---- SVG Icons (no emoji) ----
function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function ShieldAlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ---- GMT+7 Clock Hook ----
function useGMT7Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleString("en-US", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);
  return time;
}

// ---- Main Component ----
export default function DashboardPage() {
  const router = useRouter();
  const clock = useGMT7Clock();
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FileInfo | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FileInfo | null>(null);
  const [showLanIp, setShowLanIp] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [securityReport, setSecurityReport] = useState<SecurityScanResult[] | null>(null);

  // Share via Link state
  const [shareTarget, setShareTarget] = useState<FileInfo | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareExpiresHours, setShareExpiresHours] = useState<number>(24);
  const [sharePassword, setSharePassword] = useState("");
  const [shareAllowDownload, setShareAllowDownload] = useState(true);
  const [activeShareLinks, setActiveShareLinks] = useState<SharePublicInfo[]>([]);
  const [newGeneratedShareUrl, setNewGeneratedShareUrl] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showMobileUploadMenu, setShowMobileUploadMenu] = useState(false);
  const toastIdRef = useRef(0);
  const dragCounter = useRef(0);
  const currentPathRef = useRef(currentPath);
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  // Toast
  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Fetch files with optional silent background refresh (no spinner flicker)
  const fetchFiles = useCallback(async (dirPath: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(dirPath)}&_t=${Date.now()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setFiles((prev) => {
          const next: FileInfo[] = data.files;
          if (prev.length !== next.length) return next;
          for (let i = 0; i < prev.length; i++) {
            if (
              prev[i].name !== next[i].name ||
              prev[i].size !== next[i].size ||
              prev[i].modified !== next[i].modified
            ) {
              return next;
            }
          }
          return prev;
        });
      } else if (!silent) {
        addToast(data.error || "Failed to load files", "error");
      }
    } catch {
      if (!silent) addToast("Network error", "error");
    }
    if (!silent) setLoading(false);
  }, [addToast]);

  // Fetch storage
  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch(`/api/storage?_t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setStorage(data);
    } catch { /* ignore */ }
  }, []);

  // Fetch server status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (res.ok) setServerStatus(data);
    } catch { /* ignore */ }
  }, []);

  // Initial load + periodic sync (polls every 2.5s so changes on server machine reflect immediately)
  useEffect(() => {
    fetchFiles(currentPath);
    fetchStorage();
    fetchStatus();

    const interval = setInterval(() => {
      fetchFiles(currentPathRef.current, true);
      fetchStorage();
      fetchStatus();
    }, 2500);

    // Sync immediately when user switches tabs or focuses the browser window
    function handleSync() {
      if (document.visibilityState === "visible") {
        fetchFiles(currentPathRef.current, true);
        fetchStorage();
        fetchStatus();
      }
    }

    window.addEventListener("focus", handleSync);
    document.addEventListener("visibilitychange", handleSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleSync);
      document.removeEventListener("visibilitychange", handleSync);
    };
  }, [currentPath, fetchFiles, fetchStorage, fetchStatus]);

  // Navigate
  function navigateTo(path: string) { setCurrentPath(path); }
  function navigateToBreadcrumb(index: number) {
    if (index === -1) { setCurrentPath(""); return; }
    const parts = currentPath.split("/").filter(Boolean);
    setCurrentPath(parts.slice(0, index + 1).join("/"));
  }

  // Upload files with speed tracking & security inspection
  async function handleUpload(fileList: FileList) {
    if (fileList.length === 0) return;

    const newUploads: UploadItem[] = Array.from(fileList).map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      size: f.size,
      progress: 0,
      speed: "--",
      status: "uploading" as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    const allSecurityWarnings: SecurityScanResult[] = [];
    const allSecurityDeletions: SecurityScanResult[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const uploadId = newUploads[i].id;
      const formData = new FormData();
      formData.append("path", currentPathRef.current);
      formData.append("files", file);

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/files");

          let lastLoaded = 0;
          let lastTime = Date.now();

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const now = Date.now();
              const percent = Math.round((e.loaded / e.total) * 100);

              // Calculate speed
              const timeDelta = (now - lastTime) / 1000; // seconds
              const bytesDelta = e.loaded - lastLoaded;
              let speed = "--";
              if (timeDelta > 0.1) {
                speed = formatSpeed(bytesDelta / timeDelta);
                lastLoaded = e.loaded;
                lastTime = now;
              }

              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadId ? { ...u, progress: percent, speed } : u
                )
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const resData = JSON.parse(xhr.responseText);
                const warnings: SecurityScanResult[] = resData.securityWarnings || [];
                const deletions: SecurityScanResult[] = resData.securityDeletions || [];

                if (warnings.length > 0) allSecurityWarnings.push(...warnings);
                if (deletions.length > 0) allSecurityDeletions.push(...deletions);

                const isDeleted = deletions.some((d: SecurityScanResult) => d.fileName === file.name);
                const isWarning = warnings.some((w: SecurityScanResult) => w.fileName === file.name);

                if (isDeleted) {
                  setUploads((prev) =>
                    prev.map((u) =>
                      u.id === uploadId
                        ? { ...u, progress: 100, status: "error", speed: "Blocked (Dangerous)" }
                        : u
                    )
                  );
                } else {
                  setUploads((prev) =>
                    prev.map((u) =>
                      u.id === uploadId
                        ? { ...u, progress: 100, status: "done", speed: isWarning ? "Warning" : "Complete" }
                        : u
                    )
                  );
                }
              } catch {
                setUploads((prev) =>
                  prev.map((u) =>
                    u.id === uploadId ? { ...u, progress: 100, status: "done", speed: "Complete" } : u
                  )
                );
              }
              resolve();
            } else {
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadId ? { ...u, status: "error", speed: "Failed" } : u
                )
              );
              reject(new Error("Upload failed"));
            }
          };

          xhr.onerror = () => {
            setUploads((prev) =>
              prev.map((u) =>
                u.id === uploadId ? { ...u, status: "error", speed: "Failed" } : u
              )
            );
            reject(new Error("Network error"));
          };

          xhr.send(formData);
        });
      } catch {
        addToast(`Failed to upload ${file.name}`, "error");
      }
    }

    const totalIssues = allSecurityWarnings.length + allSecurityDeletions.length;
    if (totalIssues > 0) {
      setSecurityReport([...allSecurityDeletions, ...allSecurityWarnings]);
      const dangerousCount = allSecurityDeletions.length;
      const warningCount = allSecurityWarnings.length;
      if (dangerousCount > 0 && warningCount > 0) {
        addToast(`${dangerousCount} dangerous file(s) blocked & deleted, ${warningCount} uploaded with warnings.`, "error");
      } else if (dangerousCount > 0) {
        addToast(`${dangerousCount} dangerous file(s) automatically blocked & deleted!`, "error");
      } else {
        addToast(`${warningCount} file(s) uploaded with security warnings.`, "info");
      }
    } else {
      addToast(`Uploaded ${fileList.length} file(s)`, "success");
    }

    fetchFiles(currentPathRef.current);
    fetchStorage();

    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }, 4000);
  }

  const handleUploadRef = useRef(handleUpload);
  useEffect(() => {
    handleUploadRef.current = handleUpload;
  });

  // Automatically allow drag to upload anywhere from Windows Explorer
  useEffect(() => {
    function onDragEnter(e: globalThis.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files")) {
        setDragActive(true);
      }
    }

    function onDragOver(e: globalThis.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
    }

    function onDragLeave(e: globalThis.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setDragActive(false);
      }
    }

    function onDrop(e: globalThis.DragEvent) {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragActive(false);
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUploadRef.current(e.dataTransfer.files);
      }
    }

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);
  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files);
      e.target.value = "";
    }
    setShowMobileUploadMenu(false);
  }

  // Download
  function handleDownload(file: FileInfo) {
    const link = document.createElement("a");
    link.href = `/api/files/download?path=${encodeURIComponent(file.path)}`;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Preview (Google Drive-style)
  const previewableFiles = files.filter((f) => !f.isDirectory);

  const openPreview = useCallback((file: FileInfo) => {
    if (file.isDirectory) return;
    setPreviewFile(file);
    setPreviewData(null);

    const ext = getFileExtension(file.name).toLowerCase();
    const needsContent = [
      "docx", "doc", "txt", "json", "xml", "csv", "tsv", "md",
      "js", "jsx", "ts", "tsx", "html", "htm", "css", "scss",
      "py", "sh", "bash", "bat", "cmd", "ps1", "yml", "yaml", "sql", "log", "ini", "conf", "env"
    ];

    if (needsContent.includes(ext)) {
      setPreviewLoading(true);
      fetch(`/api/files/content?path=${encodeURIComponent(file.path)}&_t=${Date.now()}`, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          setPreviewData(data);
          setPreviewLoading(false);
        })
        .catch(() => {
          setPreviewLoading(false);
        });
    }
  }, []);

  const closePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewData(null);
  }, []);

  // Keyboard navigation for preview (Esc to close, Left/Right arrow to navigate)
  useEffect(() => {
    if (!previewFile) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closePreview();
      } else if (e.key === "ArrowLeft") {
        const idx = previewableFiles.findIndex((f) => f.path === previewFile?.path);
        if (idx > 0) openPreview(previewableFiles[idx - 1]);
      } else if (e.key === "ArrowRight") {
        const idx = previewableFiles.findIndex((f) => f.path === previewFile?.path);
        if (idx !== -1 && idx < previewableFiles.length - 1) openPreview(previewableFiles[idx + 1]);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewFile, previewableFiles, openPreview, closePreview]);

  // Create folder
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath, name: newFolderName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("Folder created", "success");
        setShowNewFolder(false);
        setNewFolderName("");
        fetchFiles(currentPath);
      } else {
        addToast(data.error || "Failed to create folder", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
  }

  // Rename
  async function handleRename() {
    if (!renameTarget || !renameName.trim()) return;
    try {
      const res = await fetch("/api/files/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: renameTarget.path, newName: renameName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("Renamed successfully", "success");
        setRenameTarget(null);
        setRenameName("");
        fetchFiles(currentPath);
      } else {
        addToast(data.error || "Failed to rename", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
  }

  // Delete
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: deleteTarget.path }),
      });
      const data = await res.json();
      if (res.ok) {
        addToast("Deleted successfully", "success");
        setDeleteTarget(null);
        fetchFiles(currentPath);
        fetchStorage();
      } else {
        addToast(data.error || "Failed to delete", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
  }

  // Share via Link methods
  async function openShareModal(file: FileInfo) {
    setShareTarget(file);
    setNewGeneratedShareUrl(null);
    setSharePassword("");
    setShareExpiresHours(24);
    setShareAllowDownload(true);
    setCopySuccess(false);

    try {
      const res = await fetch(`/api/share?path=${encodeURIComponent(file.path)}`);
      if (res.ok) {
        const data = await res.json();
        setActiveShareLinks(data.shares || []);
      }
    } catch {
      setActiveShareLinks([]);
    }
  }

  async function handleCreateShare() {
    if (!shareTarget) return;
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: shareTarget.path,
          expiresInHours: shareExpiresHours === 0 ? null : shareExpiresHours,
          password: sharePassword.trim() || undefined,
          allowDownload: shareAllowDownload,
        }),
      });
      const data = await res.json();
      if (res.ok && data.share) {
        const fullUrl = `${window.location.origin}/share/${data.share.id}`;
        setNewGeneratedShareUrl(fullUrl);
        setActiveShareLinks((prev) => [data.share, ...prev]);
        navigator.clipboard?.writeText(fullUrl);
        setCopySuccess(true);
        addToast("Share link created and copied to clipboard!", "success");
      } else {
        addToast(data.error || "Failed to create share link", "error");
      }
    } catch {
      addToast("Network error creating share link", "error");
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRevokeShare(shareId: string) {
    try {
      const res = await fetch("/api/share", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: shareId }),
      });
      if (res.ok) {
        setActiveShareLinks((prev) => prev.filter((s) => s.id !== shareId));
        if (newGeneratedShareUrl && newGeneratedShareUrl.includes(shareId)) {
          setNewGeneratedShareUrl(null);
        }
        addToast("Share link revoked", "info");
      } else {
        addToast("Failed to revoke share link", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
  }

  // Logout
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      {/* Header */}
      <header className="header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="header-title">Cloud Storage</span>
          <span className="status-badge" style={{
            background: serverStatus?.status === "online" ? "var(--success-dim)" : "var(--danger-dim)",
            color: serverStatus?.status === "online" ? "var(--success)" : "var(--danger)",
            border: `1px solid ${serverStatus?.status === "online" ? "var(--success)" : "var(--danger)"}`,
          }}>
            {serverStatus?.status === "online" ? "Online" : "Checking..."}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="header-clock">{clock} (GMT+7)</span>
          <nav className="header-nav">
            <button id="logout-button" className="btn btn-sm" onClick={handleLogout}>
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "24px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>

        {/* Status + Storage row */}
        <div className="dashboard-status-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Storage info */}
          {storage && (
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 10 }}>
                Storage
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {storage.usedFormatted} / {storage.totalFormatted}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: storage.percent > 85 ? "var(--danger)" : "var(--accent)" }}>
                  {storage.percent}%
                </span>
              </div>
              <div className="storage-bar-track">
                <div
                  className={`storage-bar-fill ${storage.percent > 85 ? "high" : ""}`}
                  style={{ width: `${storage.percent}%` }}
                />
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                {storage.freeFormatted} available
              </div>
            </div>
          )}

          {/* Server status */}
          {serverStatus && (
            <div className="card">
              <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 10 }}>
                Server Status
              </div>
              <div className="status-grid">
                <div className="status-row">
                  <span className="status-label">Host</span>
                  <span className="status-value">{serverStatus.hostname}</span>
                </div>
                <div className="status-row">
                  <span className="status-label">CPU</span>
                  <span className="status-value">{serverStatus.cpuCores} cores</span>
                </div>
                <div className="status-row">
                  <span className="status-label">Memory</span>
                  <span className="status-value">{serverStatus.memUsedFormatted} / {serverStatus.memTotalFormatted} ({serverStatus.memPercent}%)</span>
                </div>
                <div className="status-row">
                  <span className="status-label">Uptime</span>
                  <span className="status-value">{serverStatus.uptime}</span>
                </div>
                {serverStatus.networkInterfaces.length > 0 && (
                  <div className="status-row">
                    <span className="status-label">LAN IP</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="status-value">
                        {showLanIp
                          ? serverStatus.networkInterfaces[0].address
                          : "•••.•••.•••.•••"}
                      </span>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ padding: "1px 8px", fontSize: 11, height: 22, lineHeight: "20px" }}
                        onClick={() => setShowLanIp((prev) => !prev)}
                      >
                        {showLanIp ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div className="breadcrumb">
            <button className={`breadcrumb-item ${pathParts.length === 0 ? "active" : ""}`} onClick={() => navigateToBreadcrumb(-1)}>
              Root
            </button>
            {pathParts.map((part, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span className="breadcrumb-sep"><ChevronRight /></span>
                <button
                  className={`breadcrumb-item ${i === pathParts.length - 1 ? "active" : ""}`}
                  onClick={() => navigateToBreadcrumb(i)}
                >
                  {part}
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button id="new-folder-button" className="btn btn-sm" onClick={() => { setShowNewFolder(true); setNewFolderName(""); }}>
              + New Folder
            </button>
            <label
              htmlFor="file-upload-general"
              id="upload-button"
              className="btn btn-sm btn-primary"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Upload files from computer or mobile device"
            >
              <UploadIcon />
              <span>Upload Files</span>
            </label>
            <label
              htmlFor="file-upload-media"
              className="btn btn-sm"
              style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
              title="Upload photos and videos from camera roll or gallery"
            >
              <ImageIcon />
              <span className="hide-on-mobile-xs">Photos</span>
            </label>
            <input
              id="file-upload-general"
              ref={fileInputRef}
              type="file"
              multiple
              className="visually-hidden-file-input"
              onChange={handleFileInput}
            />
            <input
              id="file-upload-media"
              ref={mediaInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="visually-hidden-file-input"
              onChange={handleFileInput}
            />
            <input
              id="file-upload-camera"
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="visually-hidden-file-input"
              onChange={handleFileInput}
            />
          </div>
        </div>

        {/* Upload progress with speed */}
        {uploads.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {uploads.map((u) => (
              <div key={u.id} className="upload-item">
                <span className="upload-item-name">
                  {u.name}
                  <span style={{ color: "var(--text-muted)", fontSize: 11, marginLeft: 6 }}>
                    ({formatBytes(u.size)})
                  </span>
                </span>
                <div style={{ flex: 1, maxWidth: 200, minWidth: 100 }}>
                  <div className="progress-track" style={{ height: 6 }}>
                    <div
                      className="progress-fill"
                      style={{
                        width: `${u.progress}%`,
                        background: u.status === "error" ? "var(--danger)" : u.status === "done" ? "var(--success)" : "var(--accent)",
                      }}
                    />
                  </div>
                </div>
                <span className="upload-speed">{u.speed}</span>
                <span className="upload-item-percent" style={{
                  color: u.status === "error" ? "var(--danger)" : u.status === "done" ? "var(--success)" : "var(--accent)",
                }}>
                  {u.status === "error" ? "Error" : u.status === "done" ? "Done" : `${u.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Full-page drag overlay */}
        {dragActive && (
          <div className="drag-overlay">
            <div className="drag-overlay-content">
              <UploadIcon />
              <p style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>Drop files to upload</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                Files will be uploaded to the current folder
              </p>
            </div>
          </div>
        )}

        {/* File table */}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <div className="loading-spinner" />
            </div>
          ) : files.length === 0 ? (
            <div className="empty-state">
              <FolderIcon className="file-icon" />
              <p>This folder is empty</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Upload files from your computer or phone to get started.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
                <label
                  htmlFor="file-upload-general"
                  className="btn btn-primary"
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <UploadIcon />
                  <span>Upload Files</span>
                </label>
                <label
                  htmlFor="file-upload-media"
                  className="btn"
                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <ImageIcon />
                  <span>Photo & Video Gallery</span>
                </label>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="file-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Size</th>
                    <th>Type</th>
                    <th>Modified</th>
                    <th style={{ width: 220 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.path}>
                      <td>
                        <div
                          className="file-row-name"
                          onClick={() => {
                            if (file.isDirectory) {
                              navigateTo(file.path);
                            } else {
                              openPreview(file);
                            }
                          }}
                          style={{ cursor: "pointer" }}
                          title={file.isDirectory ? "Open folder" : "Preview file (Google Drive style)"}
                        >
                          {file.isDirectory ? (
                            <FolderIcon className="file-icon folder" />
                          ) : (
                            <FileIcon className="file-icon" />
                          )}
                          <span>{file.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                        {file.isDirectory ? "--" : formatBytes(file.size)}
                      </td>
                      <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {file.isDirectory ? "Folder" : getFileExtension(file.name).toUpperCase() || "File"}
                      </td>
                      <td style={{ color: "var(--text-secondary)", whiteSpace: "nowrap", fontSize: 12 }}>
                        {formatDate(file.modified)}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          {!file.isDirectory && (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => openPreview(file)}
                                title="Preview file"
                              >
                                Preview
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => openShareModal(file)}
                                title="Share via link"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <ShareIcon />
                                <span>Share</span>
                              </button>
                              <button
                                className="btn btn-sm"
                                onClick={() => handleDownload(file)}
                                title="Download file"
                              >
                                Download
                              </button>
                            </>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={() => { setRenameTarget(file); setRenameName(file.name); }}
                          >
                            Rename
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteTarget(file)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>


      </main>

      {/* ---- Modals ---- */}

      {showNewFolder && (
        <div className="modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New Folder</h3>
            <input
              id="new-folder-input"
              className="input"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setShowNewFolder(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="modal-overlay" onClick={() => setRenameTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Rename</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>
              Renaming: {renameTarget.name}
            </p>
            <input
              id="rename-input"
              className="input"
              placeholder="New name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRename} disabled={!renameName.trim() || renameName === renameTarget.name}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              {deleteTarget.isDirectory && " This will delete all contents inside this folder."}
              {" "}This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Share via Link Modal ---- */}
      {shareTarget && (
        <div className="modal-overlay" onClick={() => setShareTarget(null)}>
          <div className="share-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="share-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ShareIcon />
                <h3 style={{ margin: 0, fontSize: 16 }}>Share via Link</h3>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setShareTarget(null)}
                style={{ padding: "4px 8px" }}
              >
                <CloseIcon />
              </button>
            </div>

            <div className="share-modal-body">
              {/* Target File Card */}
              <div className="share-target-card">
                <FileIcon className="file-icon" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {shareTarget.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {formatBytes(shareTarget.size)} • {getFileExtension(shareTarget.name).toUpperCase() || "FILE"}
                  </div>
                </div>
              </div>

              {/* Expiration Setting */}
              <div className="share-field-group">
                <label className="share-field-label">Link Expiration</label>
                <select
                  className="share-select"
                  value={shareExpiresHours}
                  onChange={(e) => setShareExpiresHours(Number(e.target.value))}
                >
                  <option value={1}>1 Hour</option>
                  <option value={24}>24 Hours (1 Day)</option>
                  <option value={168}>7 Days (1 Week)</option>
                  <option value={720}>30 Days (1 Month)</option>
                  <option value={0}>Never Expires</option>
                </select>
              </div>

              {/* Password Protection */}
              <div className="share-field-group">
                <label className="share-field-label">Password Protection (Optional)</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Leave empty for public link"
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                />
              </div>

              {/* Permissions */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                <input
                  type="checkbox"
                  id="allow-download-check"
                  checked={shareAllowDownload}
                  onChange={(e) => setShareAllowDownload(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)", cursor: "pointer" }}
                />
                <label htmlFor="allow-download-check" style={{ fontSize: 13.5, cursor: "pointer", userSelect: "none" }}>
                  Allow recipients to download this file
                </label>
              </div>

              {/* Create Button */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateShare}
                disabled={shareLoading}
                style={{ width: "100%", justifyContent: "center", padding: "10px" }}
              >
                {shareLoading ? "Generating Link..." : "Create Share Link"}
              </button>

              {/* Newly Generated Share Link */}
              {newGeneratedShareUrl && (
                <div className="share-link-result">
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--accent)" }}>
                    Ready to share:
                  </div>
                  <div className="share-link-input-row">
                    <input
                      readOnly
                      className="share-link-input"
                      value={newGeneratedShareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(newGeneratedShareUrl);
                        setCopySuccess(true);
                        addToast("Link copied to clipboard!", "success");
                        setTimeout(() => setCopySuccess(false), 2500);
                      }}
                      style={{ padding: "8px 12px" }}
                    >
                      <CopyIcon />
                      <span>{copySuccess ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    Anyone with this link {sharePassword ? "(and passcode)" : ""} can view and {shareAllowDownload ? "download" : "preview"} this file.
                  </div>
                </div>
              )}

              {/* Active Existing Share Links for this File */}
              {activeShareLinks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                    Active Links ({activeShareLinks.length})
                  </div>
                  <div className="share-active-list">
                    {activeShareLinks.map((s) => {
                      const linkUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/share/${s.id}`;
                      return (
                        <div key={s.id} className="share-active-item">
                          <div style={{ minWidth: 0, flex: 1, paddingRight: 8 }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              /share/{s.id}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                              Expires: {s.expiresAt ? formatDate(s.expiresAt) : "Never"} • {s.views} view(s) {s.hasPassword ? "• Password Protected" : ""}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button
                              type="button"
                              className="btn btn-sm"
                              onClick={() => {
                                navigator.clipboard?.writeText(linkUrl);
                                addToast("Link copied to clipboard!", "success");
                              }}
                              title="Copy link"
                            >
                              <CopyIcon />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRevokeShare(s.id)}
                              title="Revoke and disable link"
                            >
                              Revoke
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="share-modal-footer">
              <button
                type="button"
                className="btn"
                onClick={() => setShareTarget(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Security Inspection Report Modal ---- */}
      {securityReport && securityReport.length > 0 && (
        <div className="modal-overlay" onClick={() => setSecurityReport(null)}>
          <div className="security-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="security-modal-header">
              <div className="security-header-left">
                <div className={`security-shield-icon ${securityReport.some((s) => s.autoDeleted) ? "is-danger" : "is-warning"}`}>
                  <ShieldAlertIcon />
                </div>
                <div>
                  <h3 className="security-modal-title">Security Inspection Alert</h3>
                  <p className="security-modal-subtitle">
                    Automated code scan detected security issues in uploaded file(s).
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="security-modal-close"
                onClick={() => setSecurityReport(null)}
                title="Close report"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Notice Banner */}
            <div className="security-policy-banner">
              <strong>Security Policy:</strong> Files with suspicious commands are <u>safely preserved and uploaded</u> with their flagged lines identified below. Only legitimately destructive files (e.g. drive format, system wipe, fork bombs, volume shadow wipes) are automatically blocked and deleted.
            </div>

            {/* Body */}
            <div className="security-modal-body">
              {securityReport.map((fileResult, fIdx) => (
                <div key={fIdx} className={`security-file-card ${fileResult.autoDeleted ? "card-danger" : "card-warning"}`}>
                  <div className="security-card-header">
                    <div className="security-card-title-group">
                      <FileIcon className="file-icon" />
                      <span className="security-card-filename">{fileResult.fileName}</span>
                    </div>
                    {fileResult.autoDeleted ? (
                      <span className="security-badge-danger">
                        🚫 Blocked & Auto-Deleted (Dangerous)
                      </span>
                    ) : (
                      <span className="security-badge-warning">
                        ⚠️ Uploaded with Warnings (Preserved)
                      </span>
                    )}
                  </div>

                  <div className="security-card-summary">
                    {fileResult.summary || (fileResult.autoDeleted
                      ? "File contained dangerous instructions and was deleted to protect system integrity."
                      : "File was uploaded successfully to storage. Suspicious lines or API patterns detected:")}
                  </div>

                  <div className="security-issues-list">
                    {fileResult.issues.map((issue, iIdx) => (
                      <div key={iIdx} className="security-issue-item">
                        <div className="security-issue-header">
                          <div className="security-issue-meta">
                            {issue.line !== undefined ? (
                              <span className="security-line-tag">Line {issue.line}</span>
                            ) : issue.offset ? (
                              <span className="security-line-tag">Offset {issue.offset}</span>
                            ) : (
                              <span className="security-line-tag">Inspection</span>
                            )}
                            <span className="security-rule-name">{issue.rule}</span>
                          </div>
                          <span className={issue.severity === "critical" ? "severity-pill critical" : "severity-pill suspicious"}>
                            {issue.severity === "critical" ? "Critical Risk" : "Suspicious"}
                          </span>
                        </div>

                        {issue.matchedText && (
                          <div className="security-code-box">
                            <div className="security-code-label">
                              {issue.line !== undefined ? `Line ${issue.line}:` : "Match:"}
                            </div>
                            <code className="security-code-content">{issue.matchedText}</code>
                          </div>
                        )}

                        <div className="security-issue-desc">
                          {issue.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="security-modal-footer">
              <span className="security-footer-info">
                {securityReport.reduce((acc, curr) => acc + curr.issues.length, 0)} issue(s) detected across {securityReport.length} file(s)
              </span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSecurityReport(null)}
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Google Drive-style File Preview Modal ---- */}
      {previewFile && (() => {
        const ext = getFileExtension(previewFile.name);
        const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext);
        const isVideo = ["mp4", "webm", "ogg", "ogv", "mov", "m4v", "mkv"].includes(ext);
        const isAudio = ["mp3", "wav", "flac", "aac", "m4a", "oga"].includes(ext);
        const isPdf = ext === "pdf";
        const isDoc = ext === "docx" || ext === "doc";
        const isJson = ext === "json";
        const isCsv = ext === "csv" || ext === "tsv";
        const isTextOrCode = [
          "txt", "xml", "md", "js", "jsx", "ts", "tsx", "html", "htm", "css", "scss",
          "py", "sh", "bash", "bat", "cmd", "ps1", "yml", "yaml", "sql", "log", "ini", "conf", "env"
        ].includes(ext);

        const currentIndex = previewableFiles.findIndex((f) => f.path === previewFile.path);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex !== -1 && currentIndex < previewableFiles.length - 1;

        return (
          <div className="preview-modal-overlay" onClick={closePreview}>
            {/* Top Bar */}
            <div className="preview-header" onClick={(e) => e.stopPropagation()}>
              <div className="preview-title-area">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={closePreview}
                  style={{ padding: "4px 8px", marginRight: 4 }}
                  title="Close preview (Esc)"
                >
                  <CloseIcon />
                </button>
                <span className="preview-file-title" title={previewFile.name}>
                  {previewFile.name}
                </span>
                <span className="preview-badge">{formatBytes(previewFile.size)}</span>
                <span className="preview-badge" style={{ textTransform: "uppercase" }}>{ext || "FILE"}</span>
              </div>

              <div className="preview-actions">
                <a
                  href={`/api/files/download?path=${encodeURIComponent(previewFile.path)}`}
                  download={previewFile.name}
                  className="btn btn-sm btn-primary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Download file"
                >
                  <DownloadIcon />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openShareModal(previewFile)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Share via link"
                >
                  <ShareIcon />
                  <span>Share</span>
                </button>
                <a
                  href={`/api/files/raw?path=${encodeURIComponent(previewFile.path)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm"
                  title="Open original file in new browser tab"
                >
                  Open in Tab
                </a>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={closePreview}
                  style={{ padding: "4px 8px" }}
                  title="Close preview"
                >
                  <CloseIcon />
                </button>
              </div>
            </div>

            {/* Security Notice Banner in Preview */}
            {previewData?.security && previewData.security.issues.length > 0 && (
              <div className="preview-security-banner" onClick={(e) => e.stopPropagation()}>
                <div className="preview-security-content">
                  <ShieldAlertIcon />
                  <span>
                    <strong>Security Notice:</strong> Scanner detected {previewData.security.issues.length} suspicious pattern(s) in this file.
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}
                  onClick={() => setSecurityReport([previewData.security])}
                >
                  View Scanned Lines
                </button>
              </div>
            )}

            {/* Navigation Arrows */}
            {hasPrev && (
              <button
                type="button"
                className="preview-nav-btn preview-nav-prev"
                onClick={(e) => {
                  e.stopPropagation();
                  openPreview(previewableFiles[currentIndex - 1]);
                }}
                title="Previous file (Left Arrow)"
              >
                ‹
              </button>
            )}
            {hasNext && (
              <button
                type="button"
                className="preview-nav-btn preview-nav-next"
                onClick={(e) => {
                  e.stopPropagation();
                  openPreview(previewableFiles[currentIndex + 1]);
                }}
                title="Next file (Right Arrow)"
              >
                ›
              </button>
            )}

            {/* Content Body */}
            <div className="preview-body" onClick={(e) => e.stopPropagation()}>
              {previewLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Loading preview...</span>
                </div>
              ) : isImage ? (
                <img
                  src={`/api/files/raw?path=${encodeURIComponent(previewFile.path)}`}
                  alt={previewFile.name}
                  className="preview-image"
                />
              ) : isVideo ? (
                <div className="preview-video-container">
                  <video
                    controls
                    autoPlay
                    playsInline
                    src={`/api/files/raw?path=${encodeURIComponent(previewFile.path)}`}
                    className="preview-video"
                  >
                    Your browser does not support HTML5 video playback.
                  </video>
                </div>
              ) : isAudio ? (
                <div className="preview-audio-card">
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-dim)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <FileIcon className="file-icon" />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{previewFile.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{formatBytes(previewFile.size)}</div>
                  </div>
                  <audio
                    controls
                    autoPlay
                    src={`/api/files/raw?path=${encodeURIComponent(previewFile.path)}`}
                    style={{ width: "100%", marginTop: 12 }}
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={`/api/files/raw?path=${encodeURIComponent(previewFile.path)}`}
                  style={{ width: "100%", maxWidth: 1000, height: "82vh", border: "none", borderRadius: 8, background: "#fff" }}
                  title={previewFile.name}
                />
              ) : isDoc ? (
                <div className="doc-paper-container">
                  <div
                    className="doc-paper"
                    dangerouslySetInnerHTML={{ __html: previewData?.html || "<p>Loading document...</p>" }}
                  />
                </div>
              ) : isJson ? (
                <pre className="code-paper">{previewData?.content || ""}</pre>
              ) : isCsv && previewData?.headers ? (
                <div className="csv-paper">
                  <table className="csv-table">
                    <thead>
                      <tr>
                        {previewData.headers.map((h: string, i: number) => (
                          <th key={i}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.rows?.map((row: string[], rIdx: number) => (
                        <tr key={rIdx}>
                          {row.map((cell: string, cIdx: number) => (
                            <td key={cIdx}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : isTextOrCode ? (
                previewData?.security?.issues?.some((i: any) => i.line !== undefined) ? (
                  <div className="code-paper code-paper-annotated">
                    {previewData.content.split("\n").map((lineText: string, idx: number) => {
                      const lineNum = idx + 1;
                      const issuesOnLine = previewData.security.issues.filter((i: any) => i.line === lineNum);
                      const hasIssue = issuesOnLine.length > 0;
                      return (
                        <div key={idx} className={`code-line-row ${hasIssue ? "has-security-issue" : ""}`}>
                          <span className="code-line-num">{lineNum}</span>
                          <span className="code-line-content">{lineText || " "}</span>
                          {hasIssue && (
                            <span
                              className="code-line-badge"
                              title={issuesOnLine.map((i: any) => `${i.rule}: ${i.description}`).join(" | ")}
                            >
                              ⚠️ Line {lineNum}: {issuesOnLine[0].rule}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <pre className="code-paper">{previewData?.content || ""}</pre>
                )
              ) : (
                <div style={{ textAlign: "center", maxWidth: 420, padding: 36, background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                  <FileIcon className="file-icon" />
                  <h3 style={{ marginTop: 16, fontSize: 16 }}>No preview available</h3>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8, marginBottom: 24 }}>
                    {previewFile.name} ({formatBytes(previewFile.size)})
                  </p>
                  <a
                    href={`/api/files/download?path=${encodeURIComponent(previewFile.path)}`}
                    download={previewFile.name}
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center", display: "inline-flex", gap: 8 }}
                  >
                    <DownloadIcon />
                    <span>Download to View</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Mobile Floating Action Button (FAB) for iOS / Android */}
      <button
        type="button"
        className="mobile-fab"
        onClick={() => setShowMobileUploadMenu(true)}
        aria-label="Upload files from mobile device"
        title="Upload from phone"
      >
        <PlusIcon />
      </button>

      {/* Mobile Upload Bottom Sheet */}
      {showMobileUploadMenu && (
        <div className="mobile-sheet-overlay" onClick={() => setShowMobileUploadMenu(false)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <div className="mobile-sheet-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload to Cloud</h3>
              <p style={{ margin: "4px 0 0 0", fontSize: 12.5, color: "var(--text-secondary)" }}>
                Target: <strong>{currentPath ? pathParts[pathParts.length - 1] : "Root"}</strong>
              </p>
            </div>

            <div className="mobile-sheet-options">
              {/* Option 1: Native File Browser (Documents, PDFs, ZIPs, any files) */}
              <label className="mobile-upload-item">
                <input
                  type="file"
                  multiple
                  className="visually-hidden-file-input"
                  onChange={handleFileInput}
                />
                <div className="mobile-upload-item-icon" style={{ background: "rgba(108, 138, 255, 0.15)", color: "var(--accent)" }}>
                  <FileIcon className="file-icon" />
                </div>
                <div className="mobile-upload-item-text">
                  <div className="mobile-upload-item-title">Files & Documents</div>
                  <div className="mobile-upload-item-desc">Browse PDF, Word, Excel, ZIP, APK, code files</div>
                </div>
              </label>

              {/* Option 2: Native Photo & Video Gallery (iOS Photos / Android Media Gallery) */}
              <label className="mobile-upload-item">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="visually-hidden-file-input"
                  onChange={handleFileInput}
                />
                <div className="mobile-upload-item-icon" style={{ background: "rgba(78, 203, 113, 0.15)", color: "var(--success)" }}>
                  <ImageIcon />
                </div>
                <div className="mobile-upload-item-text">
                  <div className="mobile-upload-item-title">Photo & Video Gallery</div>
                  <div className="mobile-upload-item-desc">Upload photos or 4K videos from camera roll</div>
                </div>
              </label>

              {/* Option 3: Camera Capture */}
              <label className="mobile-upload-item">
                <input
                  type="file"
                  accept="image/*,video/*"
                  capture="environment"
                  className="visually-hidden-file-input"
                  onChange={handleFileInput}
                />
                <div className="mobile-upload-item-icon" style={{ background: "rgba(255, 193, 69, 0.15)", color: "var(--warning)" }}>
                  <CameraIcon />
                </div>
                <div className="mobile-upload-item-text">
                  <div className="mobile-upload-item-title">Take Photo or Video</div>
                  <div className="mobile-upload-item-desc">Capture directly using phone camera</div>
                </div>
              </label>

              {/* Option 4: Create Folder */}
              <button
                type="button"
                className="mobile-upload-item"
                onClick={() => {
                  setShowMobileUploadMenu(false);
                  setShowNewFolder(true);
                  setNewFolderName("");
                }}
              >
                <div className="mobile-upload-item-icon" style={{ background: "rgba(255, 255, 255, 0.08)", color: "var(--text-primary)" }}>
                  <FolderIcon className="file-icon folder" />
                </div>
                <div className="mobile-upload-item-text">
                  <div className="mobile-upload-item-title">New Folder</div>
                  <div className="mobile-upload-item-desc">Create a new subfolder in current directory</div>
                </div>
              </button>
            </div>

            <div className="mobile-sheet-footer">
              <button
                type="button"
                className="btn"
                style={{ width: "100%", justifyContent: "center", padding: "12px", borderRadius: "10px" }}
                onClick={() => setShowMobileUploadMenu(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast ${t.type}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
