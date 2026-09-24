import Link from "next/link";

export const metadata = {
  title: "Tailscale Setup Guide - Cloud Storage",
  description: "Step-by-step guide for hosting your personal cloud storage globally using Tailscale VPN.",
};

export default function GuidePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="header">
        <span className="header-title">Cloud Storage</span>
        <nav className="header-nav">
          <Link href="/" className="btn btn-sm">Back to Files</Link>
        </nav>
      </header>

      <div className="guide-content">
        <h1>Tailscale Setup Guide</h1>
        <p>
          This guide walks you through setting up Tailscale so you can access your cloud storage
          from anywhere in the world -- from your phone on mobile data, your office PC, or any
          device on any network. Tailscale creates a private encrypted tunnel between your devices
          so your files are never exposed to the public internet.
        </p>

        <div className="guide-note">
          <p>
            <strong>Why Tailscale?</strong> It is the most secure option. Your server is never exposed
            to the public internet. Only your authorized devices can see it. All traffic is encrypted
            end-to-end using WireGuard. It works even behind firewalls and NAT without port forwarding.
          </p>
        </div>

        {/* ---- Section 1 ---- */}
        <h2>1. What You Need</h2>
        <ul>
          <li>This laptop (the host server) running and connected to the internet</li>
          <li>The cloud storage app running on this laptop</li>
          <li>A Tailscale account (free, supports up to 100 devices)</li>
          <li>Tailscale installed on every device you want to access from</li>
        </ul>

        {/* ---- Section 2 ---- */}
        <h2>2. Install Tailscale on This Laptop (Host)</h2>

        <h3><span className="guide-step-num">1</span>Create a Tailscale account</h3>
        <p>Go to the Tailscale website and sign up for a free account:</p>
        <pre><code>https://login.tailscale.com/start</code></pre>
        <p>You can sign in with Google, Microsoft, GitHub, or email.</p>

        <h3><span className="guide-step-num">2</span>Download Tailscale for Windows</h3>
        <p>Download the Windows installer from:</p>
        <pre><code>https://tailscale.com/download/windows</code></pre>
        <p>Or install via command line:</p>
        <pre><code>{`# Using winget (recommended)
winget install Tailscale.Tailscale

# Or using Chocolatey
choco install tailscale`}</code></pre>

        <h3><span className="guide-step-num">3</span>Sign in to Tailscale</h3>
        <ol>
          <li>After installation, Tailscale appears in the system tray (bottom-right of taskbar)</li>
          <li>Click the Tailscale icon and click &quot;Log in&quot;</li>
          <li>A browser window opens -- sign in with the same account you created</li>
          <li>Approve the device when prompted</li>
        </ol>

        <h3><span className="guide-step-num">4</span>Find your Tailscale IP</h3>
        <p>After connecting, your laptop gets a Tailscale IP address (starts with <code>100.x.x.x</code>). Find it by:</p>
        <pre><code>{`# Option 1: Click the Tailscale tray icon -> hover over "This device"
# Option 2: Run in PowerShell:
tailscale ip`}</code></pre>
        <p>Write down this IP. Example: <code>100.64.0.1</code></p>

        <div className="guide-note">
          <p>
            <strong>Tip:</strong> The Tailscale IP never changes. You can bookmark it and always use the same URL.
          </p>
        </div>

        {/* ---- Section 3 ---- */}
        <h2>3. Install Tailscale on Your Remote Device</h2>
        <p>
          Install Tailscale on every device you want to access your cloud storage from.
          Sign in with the <strong>same account</strong> on each device.
        </p>

        <h3>Windows / Mac / Linux</h3>
        <pre><code>{`# Download from:
https://tailscale.com/download

# Windows: winget install Tailscale.Tailscale
# Mac: available in the App Store
# Linux: curl -fsSL https://tailscale.com/install.sh | sh`}</code></pre>

        <h3>iPhone / iPad</h3>
        <ol>
          <li>Open the App Store</li>
          <li>Search for &quot;Tailscale&quot;</li>
          <li>Install and sign in with the same account</li>
          <li>Allow the VPN configuration when prompted</li>
        </ol>

        <h3>Android</h3>
        <ol>
          <li>Open the Google Play Store</li>
          <li>Search for &quot;Tailscale&quot;</li>
          <li>Install and sign in with the same account</li>
          <li>Allow the VPN configuration when prompted</li>
        </ol>

        {/* ---- Section 4 ---- */}
        <h2>4. Access Your Cloud Storage</h2>
        <p>
          Once both devices are connected to Tailscale, open a browser on your remote device and go to:
        </p>
        <pre><code>{`http://<YOUR_TAILSCALE_IP>:3000

# Example:
http://100.64.0.1:3000`}</code></pre>

        <p>
          You will see the PIN login page. Enter your PIN and you are in. This works from
          <strong> any network</strong> -- home Wi-Fi, mobile data, office network, hotel Wi-Fi,
          even another country.
        </p>

        <div className="guide-warning">
          <p>
            <strong>Important:</strong> Both devices must have Tailscale running and connected.
            On phones, make sure the Tailscale VPN toggle is ON.
          </p>
        </div>

        {/* ---- Section 5 ---- */}
        <h2>5. Enable HTTPS (Recommended)</h2>
        <p>
          Tailscale can automatically provision HTTPS certificates for your devices. This means
          encrypted connections even within the Tailscale network.
        </p>

        <h3>Enable MagicDNS</h3>
        <ol>
          <li>Go to the Tailscale admin console: <code>https://login.tailscale.com/admin/dns</code></li>
          <li>Under &quot;MagicDNS&quot;, click &quot;Enable MagicDNS&quot;</li>
          <li>This gives your devices friendly names like <code>my-laptop</code></li>
        </ol>

        <h3>Enable HTTPS certificates</h3>
        <ol>
          <li>In the same DNS page, find &quot;HTTPS Certificates&quot; and enable it</li>
          <li>Run this on your laptop to get a cert:</li>
        </ol>
        <pre><code>{`tailscale cert my-laptop.<your-tailnet>.ts.net`}</code></pre>
        <p>Then access your cloud storage via:</p>
        <pre><code>{`https://my-laptop.<your-tailnet>.ts.net:3000`}</code></pre>

        {/* ---- Section 6 ---- */}
        <h2>6. Share Access (Optional)</h2>
        <p>
          You can share access with other people without giving them your Tailscale account.
        </p>

        <h3>Option A: Tailscale sharing (easiest)</h3>
        <ol>
          <li>Go to <code>https://login.tailscale.com/admin/machines</code></li>
          <li>Click the three dots next to your laptop</li>
          <li>Click &quot;Share...&quot;</li>
          <li>Enter the email of the person you want to share with</li>
          <li>They install Tailscale, accept the share, and can access your server</li>
        </ol>

        <h3>Option B: Tailscale Funnel (public URL, no install needed)</h3>
        <p>
          If you want to give someone access without them installing Tailscale, you can
          use Tailscale Funnel to create a temporary public URL:
        </p>
        <pre><code>{`# Expose port 3000 publicly via Tailscale Funnel
tailscale funnel 3000`}</code></pre>
        <p>
          This creates a public URL like <code>https://my-laptop.tail12345.ts.net</code>
          that anyone can access. Your cloud storage PIN still protects access.
        </p>

        <div className="guide-warning">
          <p>
            <strong>Security:</strong> Funnel exposes your server to the public internet. Make sure
            you have a strong PIN set. Stop Funnel when not needed: <code>tailscale funnel --reset</code>
          </p>
        </div>

        {/* ---- Section 7 ---- */}
        <h2>7. Keep the Server Running 24/7</h2>

        <h3>Prevent laptop from sleeping</h3>
        <p>Open PowerShell as Administrator and run:</p>
        <pre><code>{`# Disable sleep on AC power
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

# Disable screen turn-off (optional)
powercfg /change monitor-timeout-ac 0`}</code></pre>

        <h3>Run the server in production mode</h3>
        <pre><code>{`# Build for production (faster and more stable)
cd E:\\cloud-storage
npm run build
npm run start`}</code></pre>

        <h3>Auto-start on boot</h3>
        <p>
          Create a batch file and place it in your Startup folder. Press <code>Win+R</code>,
          type <code>shell:startup</code>, press Enter, then create this file:
        </p>
        <pre><code>{`@echo off
title Cloud Storage Server
cd /d E:\\cloud-storage
npm run start`}</code></pre>
        <p>Save it as <code>start-cloud.bat</code>. The server will start automatically when you log in.</p>

        <div className="guide-note">
          <p>
            <strong>Tip:</strong> Tailscale starts automatically on boot by default. You only need to
            auto-start the cloud storage server.
          </p>
        </div>

        {/* ---- Section 8 ---- */}
        <h2>8. Security Checklist</h2>
        <ul>
          <li>Use a strong PIN (not something easy to guess)</li>
          <li>Keep Windows and Node.js updated</li>
          <li>Enable Tailscale key expiry in the admin console for extra security</li>
          <li>Review connected devices regularly in the Tailscale admin panel</li>
          <li>Enable MagicDNS + HTTPS for encrypted connections</li>
          <li>Keep the laptop physically secure (it holds all your files)</li>
          <li>Consider enabling Windows BitLocker on the E: drive for at-rest encryption</li>
        </ul>

        <h3>Enable BitLocker on E: drive (at-rest encryption)</h3>
        <p>This encrypts all files on the drive so they cannot be read if the laptop is stolen:</p>
        <pre><code>{`# Open PowerShell as Administrator
Enable-BitLocker -MountPoint "E:" -EncryptionMethod XtsAes256 -UsedSpaceOnly -RecoveryPasswordProtector

# Save the recovery key somewhere safe!
# You can also enable via: Control Panel -> BitLocker Drive Encryption`}</code></pre>

        {/* ---- Section 9 ---- */}
        <h2>9. Troubleshooting</h2>

        <h3>Cannot connect from remote device</h3>
        <ul>
          <li>Make sure Tailscale is running on BOTH devices (check system tray / VPN toggle)</li>
          <li>Make sure both devices are signed into the same Tailscale account</li>
          <li>Try <code>tailscale ping &lt;laptop-ip&gt;</code> from the remote device</li>
          <li>Check that the cloud storage server is running: open <code>http://localhost:3000</code> on the laptop</li>
          <li>Check Windows Firewall: allow Node.js through the firewall</li>
        </ul>

        <h3>Allow Node.js through Windows Firewall</h3>
        <pre><code>{`# Run in PowerShell as Administrator
New-NetFirewallRule -DisplayName "Node.js" -Direction Inbound -Program "C:\\Program Files\\nodejs\\node.exe" -Action Allow
New-NetFirewallRule -DisplayName "Cloud Storage 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow`}</code></pre>

        <h3>Connection is slow</h3>
        <ul>
          <li>Tailscale uses direct P2P connections when possible -- check with <code>tailscale status</code></li>
          <li>If traffic is going through a relay (DERP), it may be slower</li>
          <li>Make sure your laptop has a good internet connection</li>
          <li>For large files, a wired (Ethernet) connection is faster than Wi-Fi</li>
        </ul>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Official documentation: Tailscale (<code>tailscale.com/kb</code>).
            For support, visit <code>tailscale.com/contact</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
