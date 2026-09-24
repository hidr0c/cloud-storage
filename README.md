# Enterprise Private Cloud Storage Platform

## Document Overview
- Project Name: On-Premise Secure Cloud Storage and File Management System
- Document Type: System Architecture and Functional Specification
- Target Audience: Engineering Teams, System Administrators, Security Auditors, and Stakeholders
- Current Release: Production Candidate (v1.2.0)

---

## Executive Summary

The Enterprise Private Cloud Storage Platform is a centralized, self-hosted file repository and streaming service engineered for secure local area network (LAN) deployment. The system addresses common corporate challenges surrounding data sovereignty, privacy exposure, recurring SaaS subscription costs, and file-sharing latency by keeping organization assets strictly within internal infrastructure boundaries.

Equipped with an in-depth document parsing engine, low-latency media streaming capabilities, and an automated threat detection scanner for script and binary uploads, the platform delivers a modern, intuitive user experience comparable to leading public cloud platforms while maintaining complete on-premise governance.

---

## Business Objectives and Core Value Drivers

- Data Sovereignty and Governance: Eliminates third-party exposure by hosting all company data, documents, and media strictly within private network parameters.
- Cost Optimization: Replaces per-seat monthly cloud storage subscription fees with an efficient, low-overhead Node.js service running on existing server infrastructure.
- Zero-Friction User Experience: Provides browser-based file management, global drag-and-drop uploading, live upload speed tracking, and instant document/media previews without requiring external desktop software.
- Proactive Risk Mitigation: Protects host infrastructure by automatically inspecting executable and script uploads for malicious or destructive commands before storage commitment.
- Operational Transparency: Delivers live hardware telemetry including CPU utilization, memory distribution, disk capacity limits, and network interface status.

---

## Functional Capabilities

### 1. Storage and Document Management
- Dynamic File Navigation: Hierarchical directory tree navigation with interactive breadcrumbs and one-click path traversal.
- Drag-and-Drop Ingestion: Background drag-and-drop listener allowing users to drop single files or batches anywhere on the interface directly from their desktop file manager.
- Granular Upload Telemetry: Real-time progress bars, byte-level completion rates, and dynamic transfer speed metrics calculated per item.
- File Lifecycle Operations: Directory creation, inline file renaming, direct single-click downloads, and deletion with safety confirmation dialogs.
- Automatic State Synchronization: Real-time directory re-indexing triggered automatically when browser window focus returns or when system changes occur on the host machine.

### 2. Multi-Format Preview Engine
The preview engine eliminates the requirement to download files locally prior to inspection:
- Word Processing Documents: Native browser rendering for Microsoft Word (.docx) documents with typography styling, heading hierarchies, bulleted lists, and table formatting. Legacy Word (.doc) streams are decoded into readable text format.
- Tabular Data: Microsoft Excel and spreadsheet exports (.csv, .tsv) are rendered into interactive, scrollable tables with sticky headers.
- Structured Data and Configurations: Formatted, validated code view for JSON, XML, Markdown (.md), and major programming languages.
- High-Definition Media Streaming: Video playback (.mp4, .webm, .mov, .mkv) powered by HTTP 206 Partial Content (Range request) support, enabling instant timeline scrubbing and playback without pre-loading entire media files.
- Audio Playback: Dedicated audio player card (.mp3, .wav, .flac, .aac, .m4a) with waveform duration tracking.
- Portable Documents: Embedded full-page view for PDF documentation.
- Integrated Header Actions: Direct download button, raw tab view option, and keyboard navigation (left/right arrows, escape to dismiss).

### 3. Automated Security Inspection Engine
The system features an automated scanner that inspects scripts (.bat, .cmd, .ps1, .vbs) and PE binaries (.exe, .dll) prior to storage persistence.

The scanner differentiates between suspicious commands and critical threats under a strict preservation rule:

- Suspicious Activity (File Preserved with Line-Level Warning):
  - Suspicious files are safely stored on the server and are NOT deleted.
  - An inspection report modal automatically highlights the exact line number, rule triggered, and code excerpt for stakeholder audit.
  - Flagged behaviors include: command-line downloads (curl, wget, bitsadmin, certutil), PowerShell web requests and encoded bypass flags, Windows registry modifications (Run keys, startup persistence), process termination commands (taskkill), scheduled task creation, firewall modifications, and administrative account additions.
  - The document preview screen visually annotates flagged lines with warning indicators and line badges.

- Critical Threats (File Blocked and Automatically Deleted):
  - Files containing catastrophic or irreversible commands are immediately blocked and purged from the system.
  - Flagged behaviors include: hard drive reformatting (format [drive]:), destructive recursive root wipes (del /f /s /q c:\, rmdir /s /q c:\), fork bomb crash loops (%0|%0), disabling Windows Defender services, and volume shadow copy destruction (vssadmin delete shadows, ransomware recovery sabotage).

### 4. System Telemetry and Privacy Safeguards
- Disk Utilization Tracking: Dynamic storage analytics powered by native operating system system calls (fs.statfsSync), reporting total, allocated, and free disk space.
- Server Performance Metrics: Real-time CPU model, core availability, clock speeds, and memory consumption.
- Network Interface Management: Displays active network bindings while masking host local IP addresses behind toggleable controls to prevent shoulder-surfing and accidental exposure.

---

## Technical Specifications and Stack

- Application Framework: Next.js (App Router, Server Route Handlers, Client Components)
- Programming Language: TypeScript with strict type checking
- Styling and UI Architecture: Vanilla CSS custom design system with dark-mode aesthetic, modular design tokens, and CSS Grid/Flexbox layouts
- Session Authentication: JWT-based stateless session management stored in secure, HTTP-only browser cookies
- Password Security: Salted bcrypt cryptographic hashing with protected fallback defaults
- Storage Driver: Native Node.js Filesystem (fs) with absolute path sanitization and boundary containment checks
- Streaming Protocol: RFC 7233 HTTP Range Requests for partial content audio/video streaming

---

## Architecture and Data Flow

```text
[ Client Browser ]
        |
        |-- 1. HTTP-Only Auth Cookie / Bearer Verification
        v
[ Next.js Proxy & Security Guard (proxy.ts) ]
        |
        |-- 2. Authenticated API Routing
        v
[ API Endpoints & Route Handlers ]
        |
        +---> [ /api/files/upload ]
        |            |
        |            v
        |     [ Security Scanner (lib/securityScanner.ts) ]
        |            |
        |            +-- Critical Threat Detected? ---> Block & Purge Immediately
        |            |
        |            +-- Suspicious or Safe? ---------> Commit to Disk & Return Line Warnings
        |
        +---> [ /api/files/content ] ---> [ Document / Media Parser (lib/docParser.ts) ]
        |
        +---> [ /api/files/raw ] -------> HTTP 206 Partial Content Stream
        |
        +---> [ /api/storage ] ---------> Native Host Disk Telemetry (lib/storage.ts)
```

---

## Installation and Deployment Guide

### Prerequisites
- Node.js: Version 18.17.0 or higher
- Package Manager: npm, pnpm, or yarn
- Host Operating System: Windows Server / Windows 10/11, Linux, or macOS

### Step 1: Clone Repository and Install Dependencies
```bash
git clone <repository-url> cloud-storage
cd cloud-storage
npm install
```

### Step 2: Environment Configuration
Create a `.env.local` file in the project root directory with the following variables:
```env
# Administrative Authentication
ADMIN_PASSWORD=your_secure_password_here
ADMIN_PIN=123456

# JWT Session Encryption Key
JWT_SECRET=your_random_secure_jwt_secret_token_here

# Custom File Storage Directory (Optional - defaults to ./storage)
# STORAGE_DIR=D:\CompanyStorage
```

### Step 3: Run the Development Server
```bash
npm run dev
```
Access the application locally at `http://localhost:3000` or via network IP `http://<server-ip>:3000`.

### Step 4: Production Build and Execution
```bash
npm run build
npm run start
```

---

## Security and Governance Policies

- Path Traversal Immunity: All incoming file path parameters undergo normalization and root jail validation (sanitizePath) to prevent directory traversal exploits (`../`).
- Least-Privilege Persistence: The application operates within designated storage folders without requesting system-wide elevation.
- Safe Execution Boundary: Stored executables and batch scripts are archived as inert binary data and are never directly invoked or executed by the host server process.
- No External Dependencies for Parsing: Word documents, text formats, and spreadsheets are unpacked through native Buffer manipulations, eliminating reliance on third-party cloud APIs.

---

## Operational Roadmap

- Phase 1 (Completed): Core storage management, responsive UI, drag-and-drop uploading, and multi-format previewing.
- Phase 2 (Completed): Security scanning engine for script and executable files with line-by-line threat reporting.
- Phase 3 (Completed): Share via link system with configurable expiration, optional password protection, and public landing previews.
- Phase 4 (Planned): Multi-user role-based access control (RBAC) with read-only guest permissions.
- Phase 5 (Planned): Automated scheduled snapshot backups and client-side encryption support.
