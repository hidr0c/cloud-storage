"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import type { SharePublicInfo } from "@/lib/share";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
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

export default function ShareLandingPage() {
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [share, setShare] = useState<SharePublicInfo | null>(null);

  // Content Preview
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const fetchShareDetails = useCallback(async (pwd?: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      const url = pwd
        ? `/api/share/${encodeURIComponent(id)}?password=${encodeURIComponent(pwd)}`
        : `/api/share/${encodeURIComponent(id)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (res.status === 410 || data.error === "expired") {
        setIsExpired(true);
        setShare(data.share || null);
        setLoading(false);
        return;
      }

      if (data.requiresPassword) {
        setRequiresPassword(true);
        setShare(data.share || null);
        if (pwd) {
          setPasswordError("Incorrect password. Please try again.");
        }
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || "Failed to load shared file");
        setLoading(false);
        return;
      }

      // Successfully unlocked
      setRequiresPassword(false);
      setShare(data.share);
      if (pwd) {
        sessionStorage.setItem(`share_pwd_${id}`, pwd);
      }

      // Fetch document preview if applicable
      const ext = getFileExtension(data.share.fileName);
      const isDocument = ["docx", "doc", "json", "xml", "csv", "tsv", "txt", "md", "js", "ts", "py", "sh", "yml"].includes(ext);

      if (isDocument) {
        setPreviewLoading(true);
        const contentUrl = pwd
          ? `/api/share/${encodeURIComponent(id)}/content?password=${encodeURIComponent(pwd)}`
          : `/api/share/${encodeURIComponent(id)}/content`;

        const contentRes = await fetch(contentUrl);
        if (contentRes.ok) {
          const contentJson = await contentRes.json();
          setPreviewData(contentJson);
        }
        setPreviewLoading(false);
      }
    } catch {
      setError("Network error while connecting to cloud server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const savedPwd = typeof window !== "undefined" ? sessionStorage.getItem(`share_pwd_${id}`) : null;
    fetchShareDetails(savedPwd || undefined);
  }, [fetchShareDetails, id]);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError("Password cannot be empty");
      return;
    }
    fetchShareDetails(password.trim());
  }

  const ext = share ? getFileExtension(share.fileName) : "";
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

  const pwdParam = password ? `?password=${encodeURIComponent(password)}` : "";
  const downloadUrl = `/api/share/${encodeURIComponent(id)}/download${pwdParam}`;
  const rawUrl = `/api/share/${encodeURIComponent(id)}/raw${pwdParam}`;

  return (
    <div className="share-page-container">
      {/* Top Navbar */}
      <header className="share-navbar">
        <div className="share-navbar-brand">
          <div className="share-brand-logo">CS</div>
          <div>
            <div className="share-brand-title">Cloud Storage</div>
            <div className="share-brand-sub">Secure File Sharing</div>
          </div>
        </div>

        {share && !requiresPassword && !isExpired && (
          <div className="share-navbar-actions">
            {share.allowDownload && (
              <a
                href={downloadUrl}
                download={share.fileName}
                className="btn btn-primary"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Download ({formatBytes(share.fileSize)})</span>
              </a>
            )}
            <a
              href={rawUrl}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
            >
              Open in Tab
            </a>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="share-main">
        {loading ? (
          <div className="share-loading-card">
            <div className="loading-spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
            <p style={{ marginTop: 16, color: "var(--text-secondary)" }}>Connecting to shared file...</p>
          </div>
        ) : isExpired ? (
          <div className="share-card share-card-expired">
            <div className="share-card-icon-expired">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Share Link Expired</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8, maxWidth: 440 }}>
              The owner configured this link with an expiration date. It is no longer accessible.
            </p>
            {share && (
              <div className="share-expired-meta">
                <span>File: <strong>{share.fileName}</strong></span>
                <span>Expired on: {formatDate(share.expiresAt)}</span>
              </div>
            )}
          </div>
        ) : requiresPassword ? (
          <div className="share-card share-card-auth">
            <div className="share-card-icon-locked">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Password Protected File</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginTop: 6 }}>
              Enter the passcode set by the owner to unlock <strong>{share?.fileName}</strong>
            </p>

            <form onSubmit={handleUnlock} style={{ width: "100%", marginTop: 20 }}>
              <input
                type="password"
                className="input"
                placeholder="Enter passcode"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{ textAlign: "center", fontSize: 16, letterSpacing: 2 }}
              />
              {passwordError && (
                <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>
                  {passwordError}
                </div>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 16, justifyContent: "center", padding: "11px" }}
              >
                Unlock & View File
              </button>
            </form>
          </div>
        ) : error ? (
          <div className="share-card">
            <h2 style={{ fontSize: 18, color: "var(--danger)" }}>Unable to access file</h2>
            <p style={{ color: "var(--text-secondary)", marginTop: 8 }}>{error}</p>
          </div>
        ) : share ? (
          <div className="share-file-layout">
            {/* File Info Bar */}
            <div className="share-info-banner">
              <div className="share-info-left">
                <div className="share-file-tag">{ext.toUpperCase() || "FILE"}</div>
                <div>
                  <h1 className="share-filename">{share.fileName}</h1>
                  <div className="share-meta-row">
                    <span>Size: {formatBytes(share.fileSize)}</span>
                    <span>•</span>
                    <span>Shared: {formatDate(share.createdAt)}</span>
                    {share.expiresAt && (
                      <>
                        <span>•</span>
                        <span>Expires: {formatDate(share.expiresAt)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {share.allowDownload && (
                <a
                  href={downloadUrl}
                  download={share.fileName}
                  className="btn btn-primary share-download-btn-mobile"
                >
                  Download File
                </a>
              )}
            </div>

            {/* Preview Body */}
            <div className="share-preview-container">
              {previewLoading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 48 }}>
                  <div className="loading-spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                  <span style={{ fontSize: 13.5, color: "var(--text-secondary)", marginTop: 12 }}>Loading document preview...</span>
                </div>
              ) : isImage ? (
                <div className="share-media-box">
                  <img
                    src={rawUrl}
                    alt={share.fileName}
                    className="preview-image"
                  />
                </div>
              ) : isVideo ? (
                <div className="preview-video-container" style={{ width: "100%", maxWidth: 1000 }}>
                  <video
                    controls
                    autoPlay
                    playsInline
                    src={rawUrl}
                    className="preview-video"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              ) : isAudio ? (
                <div className="preview-audio-card" style={{ maxWidth: 480, margin: "32px auto" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{share.fileName}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{formatBytes(share.fileSize)}</div>
                  </div>
                  <audio
                    controls
                    autoPlay
                    src={rawUrl}
                    style={{ width: "100%", marginTop: 16 }}
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  src={rawUrl}
                  style={{ width: "100%", height: "82vh", border: "none", borderRadius: 8, background: "#fff" }}
                  title={share.fileName}
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
                <pre className="code-paper">{previewData?.content || ""}</pre>
              ) : (
                <div className="share-unsupported-box">
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                    {share.fileName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, marginBottom: 20 }}>
                    {formatBytes(share.fileSize)} • No preview available for this format
                  </div>
                  {share.allowDownload && (
                    <a
                      href={downloadUrl}
                      download={share.fileName}
                      className="btn btn-primary"
                      style={{ display: "inline-flex", gap: 8 }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Download File</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
