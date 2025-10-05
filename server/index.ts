import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { handleDemo } from "./routes/demo";
import authRoutes from "./routes/auth";
import adminRoutes from "./routes/admin";
import uploadRoutes from "./routes/upload";
import newsletterRoutes from "./routes/newsletters";
import { ensureDbSetup } from "./db/setup";
import { authMiddleware } from "./middleware/auth";

// Ensure DB schema and seed admin on startup
await ensureDbSetup();

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

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
  import studentsRoutes from "./routes/students";
  import teachersRoutes from "./routes/teachers";
  app.use("/api/admin", studentsRoutes);
  app.use("/api/admin", teachersRoutes);

  import bookingsRoutes from "./routes/bookings";
  app.use("/api/admin", bookingsRoutes);

  import auditRoutes from "./routes/audit";
  app.use("/api/admin", auditRoutes);

  return app;
}
