// src/routes/merge.js
import { Router } from "express";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import fssync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// outputs folder alongside src/ (i.e., packages/backend/outputs)
const outDir = path.join(__dirname, "..", "..", "outputs");
if (!fssync.existsSync(outDir)) {
  fssync.mkdirSync(outDir, { recursive: true });
}

// Multer in-memory storage; adjust limits as needed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 50, fileSize: 50 * 1024 * 1024 }, // 50 PDFs, 50MB each
});

export const mergeRouter = Router();

/**
 * POST /v1/pdf/merge
 * field: files[] (multiple)
 * response: { output: { download_url: "http://host:port/outputs/merged-<id>.pdf" } }
 */
mergeRouter.post("/merge", upload.array("files[]", 50), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length < 2) {
      return res.status(422).json({ error: { message: "Need at least 2 PDFs" } });
    }

    const merged = await PDFDocument.create();

    for (const f of files) {
      if (!f.mimetype?.includes("pdf") && !f.originalname?.toLowerCase().endsWith(".pdf")) {
        return res.status(415).json({ error: { message: "Only PDF files are supported" } });
      }
      const src = await PDFDocument.load(f.buffer /*, { ignoreEncryption: true } */);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }

    const bytes = await merged.save();
    const id = uuidv4();
    const filename = `merged-${id}.pdf`;
    const absPath = path.join(outDir, filename);
    await fs.writeFile(absPath, bytes);

    // Build absolute URL so the frontend doesn't hit Vite by accident
    const rel = `/outputs/${filename}`;
    const absolute_url = `${req.protocol}://${req.get("host")}${rel}`;
    return res.json({ output: { download_url: absolute_url } });
  } catch (err) {
    console.error("merge failed", err);
    return res.status(500).json({ error: { message: "Server error while merging PDFs" } });
  }
});
