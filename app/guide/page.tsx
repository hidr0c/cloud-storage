import Link from "next/link";

export const metadata = {
  title: "Hosting Guide - Cloud Storage",
  description: "Step-by-step guide for hosting your personal cloud storage globally.",
};

export default function GuidePage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header className="header">
        <span className="header-title">Cloud Storage</span>
        <nav className="header-nav">
          <Link href="/" className="btn btn-sm">Back to Files</Link>
        </nav>
      </header>

      <div className="guide-content">
        <h1>Hosting Guide</h1>
        <p>
          This guide explains how to make your cloud storage accessible from anywhere in the
          world -- not just your local network. You will learn three approaches: Cloudflare Tunnel
          (recommended), Tailscale (private VPN), and ngrok (quick testing).
        </p>

        {/* ---- Section 1: Prerequisites ---- */}
        <h2>1. Prerequisites</h2>
        <p>Before you begin, make sure you have:</p>
        <ul>
          <li>This laptop running and connected to the internet</li>
          <li>The cloud storage app running (you are reading this, so it is)</li>
          <li>A strong password set in the <code>.env.local</code> file</li>
        </ul>

        <div className="guide-warning">
          <p>
            <strong>Important:</strong> Change the default password before exposing this to the internet.
            Open <code>.env.local</code> in your project folder and change <code>STORAGE_PASSWORD=changeme</code> to
            a strong password. Then restart the server.
          </p>
        </div>

        {/* ---- Section 2: Local Network ---- */}
        <h2>2. Access on Local Network (Same Wi-Fi)</h2>
        <p>
          Any device on the same Wi-Fi network can access your cloud storage right now. You just need
          your laptop&apos;s local IP address.
        </p>

        <h3>Find your local IP address</h3>
        <p>Open a terminal (PowerShell or Command Prompt) and run:</p>
        <pre><code>ipconfig</code></pre>
        <p>
          Look for <code>IPv4 Address</code> under your active network adapter. It will look like
          <code>192.168.1.xxx</code> or <code>10.0.0.xxx</code>.
        </p>

        <h3>Access from another device</h3>
        <p>On your phone, tablet, or another computer connected to the same Wi-Fi, open a browser and go to:</p>
        <pre><code>http://YOUR_IP_ADDRESS:3000</code></pre>
        <p>For example: <code>http://192.168.1.100:3000</code></p>

        <div className="guide-note">
          <p>
            This only works on the same network. For access from a different network (e.g., from
            your office, a coffee shop, or another city), continue to Section 3.
          </p>
        </div>

        {/* ---- Section 3: Cloudflare Tunnel ---- */}
        <h2>3. Global Access with Cloudflare Tunnel (Recommended)</h2>
        <p>
          Cloudflare Tunnel is the best free solution for permanent, secure global access. It creates
          a secure outbound connection from your laptop to Cloudflare&apos;s network -- no port forwarding,
          no exposing your IP, and free HTTPS.
        </p>

        <h3>Step 1: Create a Cloudflare account</h3>
        <ol>
          <li>Go to <code>https://dash.cloudflare.com/sign-up</code></li>
          <li>Sign up for a free account</li>
          <li>If you have a domain, add it to Cloudflare. If not, you can use a free <code>.cfargotunnel.com</code> subdomain via quick tunnels.</li>
        </ol>

        <h3>Step 2: Install cloudflared</h3>
        <p>Download and install the Cloudflare Tunnel client:</p>
        <pre><code>{`# Windows (using winget)
winget install Cloudflare.cloudflared

# Or download directly from:
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/`}</code></pre>

        <h3>Step 3: Quick tunnel (fastest way, no domain needed)</h3>
        <p>Run this single command to get a public URL instantly:</p>
        <pre><code>cloudflared tunnel --url http://localhost:3000</code></pre>
        <p>
          You will see output like:
        </p>
        <pre><code>{`Your quick Tunnel has been created!
Visit it at:
  https://random-words-here.trycloudflare.com`}</code></pre>
        <p>
          Share that URL with anyone. They can access your cloud storage from any device, anywhere.
          The URL changes each time you restart the command.
        </p>

        <h3>Step 4: Permanent tunnel with custom domain (optional)</h3>
        <p>For a permanent URL that never changes:</p>
        <pre><code>{`# Login to Cloudflare
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create my-cloud

# Configure the tunnel
# Create a file: ~/.cloudflared/config.yml with:
tunnel: my-cloud
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: cloud.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404

# Add DNS record
cloudflared tunnel route dns my-cloud cloud.yourdomain.com

# Run the tunnel
cloudflared tunnel run my-cloud`}</code></pre>

        <div className="guide-note">
          <p>
            <strong>Tip:</strong> To run the tunnel automatically when Windows starts, install it as a service:
            <code> cloudflared service install</code>
          </p>
        </div>

        <h3>Step 5: Extra security with Cloudflare Access (optional)</h3>
        <p>
          Add an extra authentication layer before anyone even reaches your login page:
        </p>
        <ol>
          <li>Go to the Cloudflare Zero Trust dashboard</li>
          <li>Navigate to Access {"->"} Applications</li>
          <li>Add an application with your tunnel&apos;s hostname</li>
          <li>Configure a policy (e.g., email-based one-time PIN)</li>
        </ol>

        {/* ---- Section 4: Tailscale ---- */}
        <h2>4. Alternative: Tailscale (Private VPN)</h2>
        <p>
          Tailscale creates a private encrypted network between your devices. Your cloud storage
          is never exposed to the public internet -- only your authorized devices can connect.
        </p>

        <h3>Setup</h3>
        <ol>
          <li>Go to <code>https://tailscale.com</code> and create a free account</li>
          <li>Install Tailscale on this laptop (the host)</li>
          <li>Install Tailscale on each device you want to access from (phone, other PC, etc.)</li>
          <li>Sign in on all devices with the same account</li>
          <li>
            Find this laptop&apos;s Tailscale IP address (shown in the Tailscale app, usually starts
            with <code>100.x.x.x</code>)
          </li>
          <li>
            On your remote device, open a browser and go to <code>http://100.x.x.x:3000</code>
          </li>
        </ol>

        <div className="guide-note">
          <p>
            <strong>Advantage:</strong> Tailscale is the most secure option because your server is never
            exposed to the public internet. Only your authenticated devices can see it.
          </p>
        </div>

        {/* ---- Section 5: ngrok ---- */}
        <h2>5. Alternative: ngrok (Quick Testing)</h2>
        <p>
          ngrok is the simplest way to get a temporary public URL. Best for quick testing or
          one-time file sharing, not for permanent use.
        </p>

        <h3>Setup</h3>
        <ol>
          <li>Go to <code>https://ngrok.com</code> and sign up for free</li>
          <li>Download and install ngrok</li>
          <li>Connect your account: <code>ngrok config add-authtoken YOUR_TOKEN</code></li>
          <li>Start the tunnel: <code>ngrok http 3000</code></li>
          <li>Copy the public URL shown in the terminal (e.g., <code>https://xxxx.ngrok-free.app</code>)</li>
        </ol>

        <div className="guide-warning">
          <p>
            <strong>Limitation:</strong> The free tier of ngrok has bandwidth limits and the URL changes
            every time you restart. Not recommended for daily use.
          </p>
        </div>

        {/* ---- Section 6: Comparison ---- */}
        <h2>6. Comparison Table</h2>
        <div style={{ overflowX: "auto" }}>
          <table className="file-table" style={{ background: "var(--bg-secondary)", borderRadius: "var(--radius-lg)" }}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Cloudflare Tunnel</th>
                <th>Tailscale</th>
                <th>ngrok</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Cost</td><td>Free</td><td>Free (up to 100 devices)</td><td>Free (limited)</td></tr>
              <tr><td>Permanent URL</td><td>Yes (with domain)</td><td>Yes (Tailscale IP)</td><td>No (changes on restart)</td></tr>
              <tr><td>HTTPS</td><td>Automatic</td><td>Automatic</td><td>Automatic</td></tr>
              <tr><td>Public access</td><td>Yes</td><td>No (private only)</td><td>Yes</td></tr>
              <tr><td>Speed</td><td>Fast (CDN edge)</td><td>Fast (direct P2P)</td><td>Good</td></tr>
              <tr><td>Setup difficulty</td><td>Medium</td><td>Easy</td><td>Very easy</td></tr>
              <tr><td>Best for</td><td>Permanent hosting</td><td>Personal/team use</td><td>Quick testing</td></tr>
            </tbody>
          </table>
        </div>

        {/* ---- Section 7: Production Tips ---- */}
        <h2>7. Production Tips</h2>

        <h3>Keep the server running</h3>
        <p>To run the cloud storage server permanently:</p>
        <pre><code>{`# Build for production (faster performance)
npm run build

# Start the production server
npm run start

# Or use PM2 for auto-restart on crash:
npm install -g pm2
pm2 start npm --name "cloud-storage" -- start
pm2 save
pm2 startup`}</code></pre>

        <h3>Security checklist</h3>
        <ul>
          <li>Change the default password in <code>.env.local</code></li>
          <li>Change the <code>JWT_SECRET</code> to a random string (at least 32 characters)</li>
          <li>Use Cloudflare Tunnel or Tailscale for encrypted connections (HTTPS)</li>
          <li>Keep Windows and Node.js updated</li>
          <li>Make sure the laptop stays powered on and connected</li>
          <li>Consider setting up Windows power settings to prevent sleep</li>
        </ul>

        <h3>Prevent laptop from sleeping</h3>
        <p>Open PowerShell as Administrator and run:</p>
        <pre><code>{`# Disable sleep on AC power
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0`}</code></pre>

        <h3>Auto-start on boot</h3>
        <p>
          Create a batch file in your Startup folder (<code>shell:startup</code>) that runs the
          server and tunnel automatically when you log in:
        </p>
        <pre><code>{`@echo off
cd /d E:\\cloud-storage
start /B npm run start
timeout /t 5
start /B cloudflared tunnel --url http://localhost:3000`}</code></pre>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border-color)" }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Need help? Check the official documentation:
            Cloudflare Tunnel (<code>developers.cloudflare.com</code>),
            Tailscale (<code>tailscale.com/kb</code>),
            ngrok (<code>ngrok.com/docs</code>).
          </p>
        </div>
      </div>
    </div>
  );
}
