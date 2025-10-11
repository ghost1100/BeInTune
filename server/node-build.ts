import path from "path";
import { createServer } from "./index";
import * as express from "express";
import http from "http";
import { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { startBookingWorker } from "./workers/bookingWorker";

const app = createServer();
const port = process.env.PORT || 3000;

// Create HTTP server so we can attach WebSocket server
const server = http.createServer(app as any);

// Setup WebSocket server at /ws
const wss = new WebSocketServer({ server, path: "/ws" });

// Map userId -> Set of WebSocket connections for that user
const userClients: Map<string, Set<any>> = new Map();

const SECRET = process.env.JWT_SECRET || "changeme123";

wss.on("connection", (ws, req) => {
  try {
    // Extract token from query param `token` or Sec-WebSocket-Protocol header
    const url = req.url || "";
    const params = new URLSearchParams((url.split("?")[1] || ""));
    let token = params.get("token") || null;

    const protoHeader = (req.headers && (req.headers["sec-websocket-protocol"] as string)) || "";
    if (!token && protoHeader) {
      const proto = protoHeader.split(",")[0].trim();
      if (proto.startsWith("Bearer ")) token = proto.split(" ")[1];
      else token = proto;
    }

    let userId: string | null = null;
    if (token) {
      try {
        const decoded: any = jwt.verify(token, SECRET);
        userId = decoded && (decoded.sub || decoded.id || null);
      } catch (e) {
        // invalid token
        userId = null;
      }
    }

    if (!userId) {
      console.log("WebSocket connection rejected: missing/invalid token");
      try {
        ws.close(1008, "Unauthorized");
      } catch (e) {}
      return;
    }

    (ws as any).userId = userId;

    // add to map
    if (!userClients.has(userId)) userClients.set(userId, new Set());
    userClients.get(userId)!.add(ws);

    console.log(`WebSocket client connected for user: ${userId}`);

    ws.on("message", (msg: any) => {
      // optionally handle incoming messages
      try {
        const data = JSON.parse(msg.toString());
        // echo or handle pings if needed
      } catch (e) {
        // ignore non-json messages
      }
    });

    ws.on("close", () => {
      try {
        const uid = (ws as any).userId;
        if (uid && userClients.has(uid)) {
          userClients.get(uid)!.delete(ws);
          if (userClients.get(uid)!.size === 0) userClients.delete(uid);
        }
      } catch (e) {}
      console.log(`WebSocket client disconnected for user: ${userId}`);
    });

    ws.on("error", (err: any) => {
      console.error("WebSocket error for user", userId, err);
    });
  } catch (err) {
    console.error("Error handling WebSocket connection:", err);
    try { ws.close(1011, "Internal error"); } catch (e) {}
  }
});

// Broadcast helper - if userId is provided, send only to that user's connections, otherwise broadcast to all connected clients
function broadcast(userId: string | null, type: string, payload: any) {
  const msg = JSON.stringify({ type, payload });
  if (userId) {
    const set = userClients.get(userId);
    if (!set) return;
    set.forEach((c) => {
      try {
        if (c && c.readyState === 1) c.send(msg);
      } catch (e) {}
    });
  } else {
    wss.clients.forEach((c: any) => {
      try {
        if (c.readyState === 1) c.send(msg);
      } catch (e) {}
    });
  }
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

  // Start background booking worker (best-effort)
  try {
    startBookingWorker();
  } catch (err) {
    console.error('Failed to start booking worker:', err);
  }
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
