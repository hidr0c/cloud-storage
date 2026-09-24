"use client";

import { useState, FormEvent, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle clipboard paste: allow text/digits, but if image => ignore = null value
  const handlePasteData = useCallback(
    (clipboardData: DataTransfer | null, e: Event | ClipboardEvent) => {
      if (!clipboardData) return;

      // Check if clipboard contains any image
      const items = clipboardData.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/") || items[i].kind === "file") {
            // Image detected: ignore = null value (do not paste)
            e.preventDefault();
            return;
          }
        }
      }

      const files = clipboardData.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          if (files[i].type.startsWith("image/")) {
            // Ignore image
            e.preventDefault();
            return;
          }
        }
      }

      // Process pasted text
      const text = clipboardData.getData("text") || "";
      const digits = text.replace(/\D/g, "");
      e.preventDefault();
      if (digits) {
        setPin((prev) => (prev + digits).slice(0, 10));
      }
      inputRef.current?.focus();
    },
    []
  );

  // Capture typing anywhere in the browser window
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore system/browser shortcuts (Ctrl+C, Ctrl+V, Cmd+..., etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // If user types a digit (0-9)
      if (/^[0-9]$/.test(e.key)) {
        if (document.activeElement !== inputRef.current) {
          e.preventDefault();
          inputRef.current?.focus();
          setPin((prev) => (prev + e.key).slice(0, 10));
        }
      } else if (e.key === "Backspace") {
        if (document.activeElement !== inputRef.current) {
          e.preventDefault();
          inputRef.current?.focus();
          setPin((prev) => prev.slice(0, -1));
        }
      } else if (e.key === "Enter") {
        if (document.activeElement !== inputRef.current) {
          e.preventDefault();
          document.getElementById("login-button")?.click();
        }
      }
    }

    function handleWindowPaste(e: ClipboardEvent) {
      handlePasteData(e.clipboardData, e);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("paste", handleWindowPaste);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [handlePasteData]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pin) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div
      className="login-container"
      onClick={() => inputRef.current?.focus()}
      style={{ cursor: "text" }}
    >
      <div
        className="card login-card"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.focus();
        }}
      >
        <h1 style={{ textAlign: "center", marginBottom: 20 }}>Cloud Storage</h1>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <input
              ref={inputRef}
              id="pin-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              className="input"
              placeholder="••••••"
              value={pin}
              onChange={(e) =>
                setPin(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              autoFocus
              disabled={loading}
              autoComplete="current-password"
              style={{
                textAlign: "center",
                fontSize: "20px",
                letterSpacing: "6px",
                padding: "12px 16px",
              }}
            />
          </div>

          <button
            id="login-button"
            type="submit"
            className="btn btn-primary"
            style={{
              width: "100%",
              justifyContent: "center",
              padding: "12px",
              cursor: "pointer",
            }}
            disabled={loading || !pin}
          >
            {loading ? <span className="loading-spinner" /> : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
