import path from "path";
import { createServer } from "./index";
import * as express from "express";
import http from "http";
import { WebSocketServer } from "ws";

const app = createServer();
const port = process.env.PORT || 3000;

// Create HTTP server so we can attach WebSocket server
const server = http.createServer(app as any);

// Setup WebSocket server at /ws
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  console.log("WebSocket client connected");
  ws.on("message", (msg) => {
    // optionally handle incoming messages
    try {
      const data = JSON.parse(msg.toString());
      // echo or handle pings
    } catch (e) {
      // ignore
    }
  });
});

// Broadcast helper
function broadcast(type: string, payload: any) {
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((c) => {
    if (c.readyState === 1) c.send(msg);
  });
}

// expose broadcast on app locals so routes can call it
(app as any).locals.broadcast = broadcast;

// In production, serve the built SPA files
const __dirname = import.meta.dirname;
const distPath = path.join(__dirname, "../spa");

// Serve static files
app.use(express.static(distPath));

// Handle React Router - serve index.html for all non-API routes
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

server.listen(port, () => {
  console.log(`🚀 Fusion Starter server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
  console.log(`🔌 WebSocket: ws://localhost:${port}/ws`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("�� Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
