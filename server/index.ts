import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";
import newsletterRoutes from "./routes/newsletters";
import studentsRoutes from "./routes/students";
import teachersRoutes from "./routes/teachers";
import bookingsRoutes from "./routes/bookings";
import auditRoutes from "./routes/audit";
import learningRoutes from "./routes/learning";
import messagesRoutes from "./routes/messages";
import postsRoutes from "./routes/posts";
import notificationsRoutes from "./routes/notifications";
import { ensureDbSetup } from "./db/setup";
import { authMiddleware } from "./middleware/auth";

// Ensure DB schema and seed admin on startup
await ensureDbSetup();

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  // Increase payload limits to support base64 file uploads and larger JSON bodies (up to ~200MB)
  app.use(express.json({ limit: "200mb" }));
  app.use(express.urlencoded({ extended: true, limit: "200mb" }));

  // attach auth middleware (decodes JWT if present)
  app.use(authMiddleware);

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Auth and admin APIs
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin", uploadRoutes);
  app.use("/api/admin", newsletterRoutes);

  // Admin entities: teachers & students
  app.use("/api/admin", studentsRoutes);
  app.use("/api/admin", teachersRoutes);

  app.use("/api/admin", bookingsRoutes);
  app.use("/api/admin", auditRoutes);

  // Learning & messages (admin)
  app.use("/api/admin", learningRoutes);
  app.use("/api/admin", messagesRoutes);

  // Public posts/discussion routes
  app.use("/api", postsRoutes);

  // Notifications
  app.use("/api", notificationsRoutes);

  // Background cleanup: permanently remove expired messages every hour
  const cleanupIntervalMs = Number(process.env.CLEANUP_INTERVAL_MS || String(1000 * 60 * 60));
  const cleanupJob = async () => {
    try {
      await (await import("./db")).query(
        "DELETE FROM messages WHERE expire_at IS NOT NULL AND expire_at <= now() AND (saved_by IS NULL OR jsonb_array_length(saved_by)=0)"
      );
      console.log("Expired messages cleanup completed");
    } catch (err) {
      console.error("Cleanup job error:", err);
    }
  };
  const cleanupHandle = setInterval(cleanupJob, cleanupIntervalMs);
  // ensure server shutdown clears interval
  (app as any).locals.cleanupHandle = cleanupHandle;

  return app;
}
