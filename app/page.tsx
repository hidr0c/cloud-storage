"use client";

import { useState, useEffect, useCallback, useRef, ChangeEvent } from "react";
import { useRouter } from "next/navigation";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Upload files with speed tracking
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
              setUploads((prev) =>
                prev.map((u) =>
                  u.id === uploadId ? { ...u, progress: 100, status: "done", speed: "Complete" } : u
                )
              );
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

    addToast(`Uploaded ${fileList.length} file(s)`, "success");
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
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
          <div style={{ display: "flex", gap: 8 }}>
            <button id="new-folder-button" className="btn btn-sm" onClick={() => { setShowNewFolder(true); setNewFolderName(""); }}>
              + New Folder
            </button>
            <button
              id="upload-button"
              className="btn btn-sm btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: "none" }}
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
              <p style={{ fontSize: 12, marginTop: 4 }}>Upload files or create a new folder to get started.</p>
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
                    <th style={{ width: 140 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.path}>
                      <td>
                        <div
                          className="file-row-name"
                          onClick={() => { if (file.isDirectory) navigateTo(file.path); }}
                          style={{ cursor: file.isDirectory ? "pointer" : "default" }}
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
                            <button className="btn btn-sm" onClick={() => handleDownload(file)}>
                              Download
                            </button>
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
