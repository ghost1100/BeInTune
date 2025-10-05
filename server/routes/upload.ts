import express from "express";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { query } from "../db";

const router = express.Router();

// POST /api/admin/upload
// body: { filename, data } where data is base64 image data
router.post("/upload", async (req, res) => {
  const { filename, data } = req.body as { filename?: string; data?: string };
  if (!filename || !data) return res.status(400).json({ error: "Missing filename or data" });

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    // ignore
  }

  const ext = path.extname(filename) || ".jpg";
  const id = cryptoRandomId();
  const outFilename = `${id}${ext}`;
  const outPath = path.join(uploadsDir, outFilename);

  const buffer = Buffer.from(data, "base64");

  try {
    // Use sharp to resize to max width 1600 while preserving aspect
    const img = sharp(buffer).rotate();
    const metadata = await img.metadata();
    if ((metadata.width || 0) > 1600) {
      await img.resize({ width: 1600 }).toFile(outPath);
    } else {
      await img.toFile(outPath);
    }

    const url = `/uploads/${outFilename}`;
    const result = await query(
      "INSERT INTO media(bucket_key, url, mime, size, uploaded_by) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [outFilename, url, metadataFormat(metadata), buffer.length, null]
    );

    res.json({ ok: true, url, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

function metadataFormat(m: any) {
  if (!m) return null;
  return m.format || null;
}

function cryptoRandomId() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

export default router;
