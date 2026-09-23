"use client";

import { useState, useEffect, useCallback, useRef, DragEvent, ChangeEvent } from "react";
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

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

interface UploadItem {
  name: string;
  progress: number;
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

// ---- Main Component ----
export default function DashboardPage() {
  const router = useRouter();
  const [currentPath, setCurrentPath] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FileInfo | null>(null);
  const [renameName, setRenameName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<FileInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  let toastId = useRef(0);

  // Toast
  const addToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Fetch files
  const fetchFiles = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (res.ok) {
        setFiles(data.files);
      } else {
        addToast(data.error || "Failed to load files", "error");
      }
    } catch {
      addToast("Network error", "error");
    }
    setLoading(false);
  }, [addToast]);

  // Fetch storage
  const fetchStorage = useCallback(async () => {
    try {
      const res = await fetch("/api/storage");
      const data = await res.json();
      if (res.ok) {
        setStorage(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchFiles(currentPath);
    fetchStorage();
  }, [currentPath, fetchFiles, fetchStorage]);

  // Navigate to folder
  function navigateTo(path: string) {
    setCurrentPath(path);
  }

  // Navigate via breadcrumb
  function navigateToBreadcrumb(index: number) {
    if (index === -1) {
      setCurrentPath("");
      return;
    }
    const parts = currentPath.split("/").filter(Boolean);
    const newPath = parts.slice(0, index + 1).join("/");
    setCurrentPath(newPath);
  }

  // Upload files
  async function handleUpload(fileList: FileList) {
    if (fileList.length === 0) return;

    const newUploads: UploadItem[] = Array.from(fileList).map((f) => ({
      name: f.name,
      progress: 0,
      status: "uploading" as const,
    }));
    setUploads((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const formData = new FormData();
      formData.append("path", currentPath);
      formData.append("files", file);

      try {
        // Use XMLHttpRequest for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/files");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              setUploads((prev) =>
                prev.map((u) =>
                  u.name === file.name ? { ...u, progress: percent } : u
                )
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploads((prev) =>
                prev.map((u) =>
                  u.name === file.name ? { ...u, progress: 100, status: "done" } : u
                )
              );
              resolve();
            } else {
              setUploads((prev) =>
                prev.map((u) =>
                  u.name === file.name ? { ...u, status: "error" } : u
                )
              );
              reject(new Error("Upload failed"));
            }
          };

          xhr.onerror = () => {
            setUploads((prev) =>
              prev.map((u) =>
                u.name === file.name ? { ...u, status: "error" } : u
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
    fetchFiles(currentPath);
    fetchStorage();

    // Clear completed uploads after delay
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status === "uploading"));
    }, 3000);
  }

  // Drag and drop
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }
  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }
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

  // Breadcrumb parts
  const pathParts = currentPath ? currentPath.split("/").filter(Boolean) : [];

  return (
    <div
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <header className="header">
        <span className="header-title">Cloud Storage</span>
        <nav className="header-nav">
          <a href="/guide" className="btn btn-sm">Guide</a>
          <button id="logout-button" className="btn btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </nav>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "24px", maxWidth: 1200, width: "100%", margin: "0 auto" }}>
        {/* Storage info */}
        {storage && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                Storage: {storage.usedFormatted} of {storage.totalFormatted} used
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: storage.percent > 85 ? "var(--danger)" : "var(--text-primary)" }}>
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
              {storage.freeFormatted} free
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          {/* Breadcrumb */}
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

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button id="new-folder-button" className="btn btn-sm" onClick={() => { setShowNewFolder(true); setNewFolderName(""); }}>
              + New Folder
            </button>
            <button
              id="upload-button"
              className="btn btn-sm btn-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload
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

        {/* Upload progress */}
        {uploads.length > 0 && (
          <div style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 6 }}>
            {uploads.map((u, i) => (
              <div key={i} className="upload-item">
                <span className="upload-item-name">{u.name}</span>
                <div style={{ flex: 1, maxWidth: 200 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${u.progress}%` }} />
                  </div>
                </div>
                <span className="upload-item-percent">
                  {u.status === "error" ? "Error" : u.status === "done" ? "Done" : `${u.progress}%`}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Drop zone overlay */}
        {dragActive && (
          <div
            className="dropzone active"
            style={{ marginBottom: 16 }}
          >
            <UploadIcon />
            <p style={{ marginTop: 8, fontSize: 14 }}>Drop files here to upload</p>
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
                    <th style={{ width: 120 }}>Actions</th>
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
                            }
                          }}
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
                            <button
                              className="btn btn-sm"
                              onClick={() => handleDownload(file)}
                              title="Download"
                            >
                              Download
                            </button>
                          )}
                          <button
                            className="btn btn-sm"
                            onClick={() => {
                              setRenameTarget(file);
                              setRenameName(file.name);
                            }}
                            title="Rename"
                          >
                            Rename
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setDeleteTarget(file)}
                            title="Delete"
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

        {/* Click to upload when empty */}
        {!loading && files.length === 0 && !dragActive && (
          <div
            className="dropzone"
            style={{ marginTop: 16 }}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadIcon />
            <p style={{ marginTop: 8, fontSize: 14 }}>Click or drag files here to upload</p>
          </div>
        )}
      </main>

      {/* ---- Modals ---- */}

      {/* New Folder Modal */}
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

      {/* Rename Modal */}
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              {deleteTarget.isDirectory && " This will delete all contents inside this folder."}
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
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
