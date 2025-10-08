import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { query } from "../db";

const SECRET = process.env.JWT_SECRET || "changeme123";

export interface AuthRequest extends Express.Request {
  user?: any;
}

export const authMiddleware: RequestHandler = async (req: any, res, next) => {
  try {
    const token =
      req.cookies?.token || req.headers.authorization?.split(" ")[1];
    if (!token) return next();
    const decoded: any = jwt.verify(token, SECRET);
    if (!decoded || !decoded.sub) return next();
    const userRes = await query(
      "SELECT id, email, email_encrypted, username, role FROM users WHERE id = $1",
      [decoded.sub],
    );
    const user = userRes.rows[0];
    if (user) {
      if (!user.email && user.email_encrypted) {
        try {
          const { decryptText } = await import("../lib/crypto");
          const parsed =
            typeof user.email_encrypted === "string"
              ? JSON.parse(user.email_encrypted)
              : user.email_encrypted;
          const dec = decryptText(parsed);
          if (dec) user.email = dec;
        } catch (e) {}
      }
      req.user = user;
    }
  } catch (err) {
    console.error("auth middleware error", err);
  }
  return next();
};

export function requireAdmin(req: any, res: any, next: any) {
  if (!req.user || req.user.role !== "admin")
    return res.status(403).json({ error: "Forbidden" });
  next();
}
