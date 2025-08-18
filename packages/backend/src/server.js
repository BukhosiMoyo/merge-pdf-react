import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import pino from 'pino';
import dotenv from 'dotenv';
import archiver from 'archiver';
import { promises as fsp } from 'fs'; // for stats

dotenv.config();

// ✅ define these BEFORE any use of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- simple persistent counter for total PDFs compressed --- //
const DATA_DIR = path.join(__dirname, '../data');     // new folder
const COUNTER_PATH = path.join(DATA_DIR, 'stats.json');

async function readCounter() {
  try {
    const raw = await fsp.readFile(COUNTER_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { total_compressed: 0, updated_at: new Date().toISOString() };
  }
}

async function writeCounter(obj) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(COUNTER_PATH, JSON.stringify(obj), 'utf8');
}

async function bumpTotal() {
  const s = await readCounter();
  s.total_compressed = (s.total_compressed || 0) + 1;
  s.updated_at = new Date().toISOString();
  await writeCounter(s);
  return s;
}

// Ensure working folders exist in production
const UP_DIR = path.join(__dirname, '../uploads');
const TMP_DIR = path.join(__dirname, '../tmp');
const INDEX_DIR = path.join(TMP_DIR, 'index');
[UP_DIR, TMP_DIR, INDEX_DIR].forEach(p => fs.mkdirSync(p, { recursive: true }));

const app = express();
const log = pino();

// Allow local dev frontends to talk to the API
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});


// simple health check
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

// public stats summary for homepage
app.get('/v1/stats/summary', async (req, res) => {
  try {
    const s = await readCounter();
    res.json(s);
  } catch (e) {
    res.status(500).json({ error: { code: 'stats_read_failed', message: e.message } });
  }
});

// POST /v1/reviews  { rating: 1..5, locale?: 'en' | 'af' | ... }
app.post('/v1/reviews', express.json(), async (req, res) => {
  try {
    const { rating, locale } = req.body || {};
    const r = Number(rating);
    if (!Number.isFinite(r) || r < 1 || r > 5) {
      return res.status(400).json({ error: { code: 'invalid_rating', message: 'Rating must be 1..5' } });
    }

    // basic rate-limit by IP hash (<= 1 submit per 12h)
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const ipHash = Buffer.from(ip).toString('base64').slice(0, 16);
    const now = Date.now();

    const reviews = await readReviews();
    const recent = reviews.findLast(r => r.ipHash === ipHash);
    if (!recent || (now - recent.ts) >= 12 * 60 * 60 * 1000) {
      reviews.push({
        rating: Math.round(r),
        locale: typeof locale === 'string' ? locale : 'en',
        ts: now,
        ipHash
      });
      await writeReviews(reviews);
    }

    const total = summarize(reviews);
    return res.json({ ok: true, ...total });
  } catch (e) {
    return res.status(500).json({ error: { code: 'reviews_write_failed', message: e.message } });
  }
});

// GET /v1/reviews/summary[?locale=en]
app.get('/v1/reviews/summary', async (req, res) => {
  try {
    const { locale } = req.query || {};
    const reviews = await readReviews();
    return res.json(summarize(reviews, typeof locale === 'string' ? locale : undefined));
  } catch (e) {
    return res.status(500).json({ error: { code: 'reviews_read_failed', message: e.message } });
  }
});



const MAX_SIZE = 50 * 1024 * 1024; // 50MB

// Multer config for temporary file storage
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.includes('pdf') && !file.originalname.toLowerCase().endsWith('.pdf')) {
      return cb(new Error('invalid_file_type'));
    }
    cb(null, true);
  }
});

// Build Ghostscript args
function gsArgs(input, output, quality = 'printer', dpi = 150, removeMeta = false) {
  // quality map: 'screen' (smallest), 'ebook', 'printer' (good default), 'prepress' (best quality)
  const base = [
    '-sDEVICE=pdfwrite',
    `-dPDFSETTINGS=/${quality}`,
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dDownsampleColorImages=true',
    `-dColorImageResolution=${dpi}`,
    '-dDownsampleGrayImages=true',
    `-dGrayImageResolution=${dpi}`,
    '-dDownsampleMonoImages=true',
    `-dMonoImageResolution=${dpi}`,
    '-dNOPAUSE',
    '-dBATCH',
    `-sOutputFile=${output}`,
    input
  ];
  if (removeMeta) base.unshift('-dDiscardDocInfo=true');
  return base;
}

app.post('/v1/pdf/compress', upload.single('file'), async (req, res) => {
  try {
    const { path: inPath, originalname, size } = req.file || {};
    if (!inPath) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'No file uploaded' } });
    }

    // 🔵 LOG #1 — when upload is accepted
    console.log(
      'UPLOAD START:',
      originalname,
      (size / 1e6).toFixed(2) + 'MB',
      new Date().toISOString()
    );

    const {
      compression = 'medium',
      downsample_dpi = '150',
      remove_metadata = 'false'
    } = req.body || {};

    const map = { low: 'prepress', medium: 'printer', high: 'screen' };
    const quality = map[compression] || 'printer';
    const dpi = Number.isNaN(parseInt(downsample_dpi, 10)) ? 150 : parseInt(downsample_dpi, 10);
    const rm = String(remove_metadata) === 'true';

    const jobId = `cpdf_${uuid().slice(0, 8)}`;
    const outName = (originalname || 'file.pdf').replace(/\.pdf$/i, '') + '-compressed.pdf';
    const outPath = path.join(__dirname, '../tmp', `${jobId}-${outName}`);

    // Ensure tmp/index exists
    const indexDir = path.join(__dirname, '../tmp/index');
    fs.mkdirSync(indexDir, { recursive: true });

    const args = gsArgs(inPath, outPath, quality, dpi, rm);
    const gs = spawn('gs', ['-q', ...args]);

    // 🔵 GS stderr log (see progress/warnings)
    gs.stderr?.on('data', d => log.warn({ gs: d.toString() }));

    // 🔵 Watchdog: kill GS if it runs too long (3 min)
    const watchdog = setTimeout(() => {
      try {
        console.warn(`GS watchdog: killing process for ${originalname}`);
        gs.kill('SIGKILL');
      } catch {}
    }, 180000);

    gs.on('error', (e) => {
      clearTimeout(watchdog);
      log.error(e);
      return res.status(422).json({ error: { code: 'processing_failed', message: e.message } });
    });

    gs.on('close', (code) => {
      clearTimeout(watchdog);


      if (code !== 0 || !fs.existsSync(outPath)) {
        return res.status(422).json({ error: { code: 'processing_failed', message: 'Ghostscript failed' } });
      }

        // bump global counter on successful compression
      bumpTotal().catch(e => log.error({ bump_error: e.message }));

      // --- reviews storage (very simple JSON file) ---
      const REVIEWS_PATH = path.join(DATA_DIR, 'reviews.json');

      async function readReviews() {
        try {
          const raw = await fsp.readFile(REVIEWS_PATH, 'utf8');
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      async function writeReviews(arr) {
        await fsp.mkdir(DATA_DIR, { recursive: true });
        await fsp.writeFile(REVIEWS_PATH, JSON.stringify(arr), 'utf8');
      }

      function summarize(reviews, locale) {
        const list = locale ? reviews.filter(r => r.locale === locale) : reviews;
        const ratingCount = list.length;
        const ratingValue = ratingCount
          ? Number((list.reduce((s, r) => s + r.rating, 0) / ratingCount).toFixed(1))
          : 0;
        return { ratingCount, ratingValue };
      }

      const outSize = fs.statSync(outPath).size;
      const ratio = 1 - (outSize / size);
      const token = uuid().replace(/-/g, '').slice(0, 24);
      const ttlMinutes = parseInt(process.env.FILE_TTL_MIN || '15', 10);
      const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

      fs.writeFileSync(path.join(indexDir, `${jobId}.json`), JSON.stringify({
        jobId, inPath, outPath, token, expiresAt
      }));

      // 🔵 LOG #2 — success timing
      console.log('UPLOAD DONE :', originalname, '->', outName, new Date().toISOString());

      return res.json({
        job_id: jobId,
        status: 'completed',
        input: { filename: originalname, bytes: size },
        output: {
          filename: outName,
          bytes: outSize,
          compression_ratio: Number(ratio.toFixed(2)),
          download_url: `/v1/jobs/${jobId}/download?token=${token}`,
          expires_at: new Date(expiresAt).toISOString()
        },
        options: { compression, downsample_dpi: dpi, remove_metadata: rm }
      });
    });
  } catch (e) {
    return res.status(500).json({ error: { code: 'internal_error', message: e.message } });
  }
});


app.get('/v1/jobs/:jobId/download', (req, res) => {
  const { jobId } = req.params;
  const { token } = req.query;

  const metaPath = path.join(__dirname, '../tmp/index', `${jobId}.json`);
  if (!fs.existsSync(metaPath)) return res.status(404).end();

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (token !== meta.token) return res.status(403).end();
  if (Date.now() > meta.expiresAt) return res.status(403).end();

  const filename = path.basename(meta.outPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', filename.endsWith('.zip') ? 'application/zip' : 'application/pdf');


  fs.createReadStream(meta.outPath).pipe(res);
});

// POST /v1/jobs/zip  { items: [{ job_id, token }] }
app.post('/v1/jobs/zip', express.json(), async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'items required' } });
    }

    const indexDir = path.join(__dirname, '../tmp/index');
    const files = [];

    for (const { job_id, token } of items) {
      const metaPath = path.join(indexDir, `${job_id}.json`);
      if (!fs.existsSync(metaPath)) continue;

      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (Date.now() > meta.expiresAt) continue;
      if (token !== meta.token) continue;
      if (!fs.existsSync(meta.outPath)) continue;

      files.push({ path: meta.outPath, name: path.basename(meta.outPath) });
    }

    if (files.length === 0) {
      return res.status(404).json({ error: { code: 'not_found', message: 'no valid files' } });
    }

    const jobId = `zip_${uuid().slice(0, 8)}`;
    const zipPath = path.join(__dirname, '../tmp', `${jobId}.zip`);
    const token = uuid().replace(/-/g, '').slice(0, 24);
    const ttlMinutes = parseInt(process.env.FILE_TTL_MIN || '15', 10);
    const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      for (const f of files) archive.file(f.path, { name: f.name });
      archive.finalize();
    });

    // index the zip just like other jobs
    const indexPath = path.join(__dirname, '../tmp/index', `${jobId}.json`);
    fs.writeFileSync(indexPath, JSON.stringify({ jobId, outPath: zipPath, token, expiresAt }));

    return res.json({
      job_id: jobId,
      status: 'completed',
      download_url: `/v1/jobs/${jobId}/download?token=${token}`,
      expires_at: new Date(expiresAt).toISOString(),
      count: files.length
    });
  } catch (e) {
    return res.status(500).json({ error: { code: 'internal_error', message: e.message } });
  }
});


// Simple periodic cleanup (in prod use a cronjob/systemd timer)
setInterval(() => {
  try {
    const indexDir = path.join(__dirname, '../tmp/index');
    if (!fs.existsSync(indexDir)) return;
    for (const f of fs.readdirSync(indexDir)) {
      const meta = JSON.parse(fs.readFileSync(path.join(indexDir, f), 'utf8'));
      if (Date.now() > meta.expiresAt) {
        [meta.inPath, meta.outPath, path.join(indexDir, f)].forEach(p => { try { fs.unlinkSync(p); } catch {} });
      }
    }
  } catch (e) {
    log.error(e);
  }
}, 60_000);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => log.info(`API up on :${PORT}`));
