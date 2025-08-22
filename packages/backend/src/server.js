// src/server.js
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
import { promises as fsp } from 'fs';

import { mergeRouter } from './routes/merge.js';
import { emailRouter } from "./routes/email.js";


dotenv.config();

// --- paths / dirs ------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');
const UP_DIR = path.join(__dirname, '../uploads');
const TMP_DIR = path.join(__dirname, '../tmp');
const INDEX_DIR = path.join(TMP_DIR, 'index');

[DATA_DIR, UP_DIR, TMP_DIR, INDEX_DIR].forEach(p => fs.mkdirSync(p, { recursive: true }));

// --- very simple stats (compressed counter) ----------------------------------
const COUNTER_PATH = path.join(DATA_DIR, 'stats.json');
async function readCounter() {
  try { return JSON.parse(await fsp.readFile(COUNTER_PATH, 'utf8')); }
  catch { return { total_compressed: 0, updated_at: new Date().toISOString() }; }
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

// --- very simple reviews aggregate ------------------------------------------
const REVIEWS_PATH = path.join(DATA_DIR, 'reviews.json');
async function readReviews() {
  try { return JSON.parse(await fsp.readFile(REVIEWS_PATH, 'utf8')); }
  catch { return { count: 0, sum: 0, distribution: { '1':0,'2':0,'3':0,'4':0,'5':0 }, updated_at: new Date().toISOString() }; }
}
async function writeReviews(obj) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(REVIEWS_PATH, JSON.stringify(obj), 'utf8');
}

const app = express();
const log = pino();

// --- middleware --------------------------------------------------------------
app.use(cors({
  origin: (origin, cb) => cb(null, true),
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve merged outputs so browser can download /outputs/merged-*.pdf
app.use('/outputs', express.static(path.join(__dirname, '..', 'outputs')));

// Mount /v1/pdf/merge (implemented in routes/merge.js)
app.use('/v1/pdf', mergeRouter);

// Logs
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- health & stats ----------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

app.get('/v1/stats/summary', async (_req, res) => {
  try { res.json(await readCounter()); }
  catch (e) { res.status(500).json({ error: { code: 'stats_read_failed', message: e.message } }); }
});

// Reviews (aggregate only)
app.get('/v1/reviews/summary', async (_req, res) => {
  try {
    const r = await readReviews();
    const avg = r.count ? (r.sum / r.count) : 0;
    res.json({ reviewCount: r.count, ratingValue: Number(avg.toFixed(2)), distribution: r.distribution, updated_at: r.updated_at });
  } catch (e) {
    res.status(500).json({ error: { code: 'reviews_read_failed', message: e.message } });
  }
});

app.post('/v1/reviews', async (req, res) => {
  try {
    const n = Number(req.body?.rating);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return res.status(400).json({ error: { code: 'invalid_rating', message: 'rating must be 1..5' } });
    }
    const r = await readReviews();
    r.count += 1;
    r.sum += n;
    r.distribution[String(n)] = (r.distribution[String(n)] || 0) + 1;
    r.updated_at = new Date().toISOString();
    await writeReviews(r);
    const avg = r.sum / r.count;
    res.json({ ok: true, reviewCount: r.count, ratingValue: Number(avg.toFixed(2)) });
  } catch (e) {
    res.status(500).json({ error: { code: 'reviews_write_failed', message: e.message } });
  }
});

// --- compression route (Ghostscript) ----------------------------------------
const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UP_DIR),
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

function gsArgs(input, output, quality = 'printer', dpi = 150, removeMeta = false) {
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
    if (!inPath) return res.status(400).json({ error: { code: 'invalid_request', message: 'No file uploaded' } });

    console.log('UPLOAD START:', originalname, (size / 1e6).toFixed(2) + 'MB', new Date().toISOString());

    const { compression = 'medium', downsample_dpi = '150', remove_metadata = 'false' } = req.body || {};
    const map = { low: 'prepress', medium: 'printer', high: 'screen' };
    const quality = map[compression] || 'printer';
    const dpi = Number.isNaN(parseInt(downsample_dpi, 10)) ? 150 : parseInt(downsample_dpi, 10);
    const rm = String(remove_metadata) === 'true';

    const jobId = `cpdf_${uuid().slice(0, 8)}`;
    const outName = (originalname || 'file.pdf').replace(/\.pdf$/i, '') + '-compressed.pdf';
    const outPath = path.join(TMP_DIR, `${jobId}-${outName}`);

    fs.mkdirSync(INDEX_DIR, { recursive: true });

    const gs = spawn('gs', ['-q', ...gsArgs(inPath, outPath, quality, dpi, rm)]);
    const watchdog = setTimeout(() => { try { gs.kill('SIGKILL'); } catch {} }, 180000);

    gs.stderr?.on('data', d => log.warn({ gs: d.toString() }));
    gs.on('error', (e) => { clearTimeout(watchdog); return res.status(422).json({ error: { code: 'processing_failed', message: e.message } }); });
    gs.on('close', (code) => {
      clearTimeout(watchdog);
      if (code !== 0 || !fs.existsSync(outPath)) {
        return res.status(422).json({ error: { code: 'processing_failed', message: 'Ghostscript failed' } });
      }

      bumpTotal().catch(e => log.error({ bump_error: e.message }));

      const outSize = fs.statSync(outPath).size;
      const ratio = 1 - (outSize / size);
      const token = uuid().replace(/-/g, '').slice(0, 24);
      const ttlMinutes = parseInt(process.env.FILE_TTL_MIN || '15', 10);
      const expiresAt = Date.now() + (ttlMinutes * 60 * 1000);

      fs.writeFileSync(path.join(INDEX_DIR, `${jobId}.json`), JSON.stringify({ jobId, inPath, outPath, token, expiresAt }));

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

  const metaPath = path.join(INDEX_DIR, `${jobId}.json`);
  if (!fs.existsSync(metaPath)) return res.status(404).end();

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (token !== meta.token) return res.status(403).end();
  if (Date.now() > meta.expiresAt) return res.status(403).end();

  const filename = path.basename(meta.outPath);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', filename.endsWith('.zip') ? 'application/zip' : 'application/pdf');
  fs.createReadStream(meta.outPath).pipe(res);
});

app.post('/v1/jobs/zip', express.json(), async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: { code: 'invalid_request', message: 'items required' } });
    }

    const files = [];
    for (const { job_id, token } of items) {
      const metaPath = path.join(INDEX_DIR, `${job_id}.json`);
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
    const zipPath = path.join(TMP_DIR, `${jobId}.zip`);
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

    fs.writeFileSync(path.join(INDEX_DIR, `${jobId}.json`), JSON.stringify({ jobId, outPath: zipPath, token, expiresAt }));

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

app.use("/v1/email", emailRouter);


// cleanup
setInterval(() => {
  try {
    if (!fs.existsSync(INDEX_DIR)) return;
    for (const f of fs.readdirSync(INDEX_DIR)) {
      const meta = JSON.parse(fs.readFileSync(path.join(INDEX_DIR, f), 'utf8'));
      if (Date.now() > meta.expiresAt) {
        [meta.inPath, meta.outPath, path.join(INDEX_DIR, f)].forEach(p => { try { fs.unlinkSync(p); } catch {} });
      }
    }
  } catch (e) { log.error(e); }
}, 60_000);

// --- Multer / generic error handler (must be after routes) ---
app.use((err, req, res, next) => {
  // Multer file-too-large
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: {
        code: 'file_too_large',
        message: 'This PDF exceeds the maximum upload size.',
        maxBytes: MAX_SIZE,
        maxMB: Math.round(MAX_SIZE / 1e6)
      }
    });
  }

  // Multer invalid type (from your fileFilter)
  if (err && err.message === 'invalid_file_type') {
    return res.status(400).json({
      error: { code: 'invalid_file_type', message: 'Only .pdf files are allowed.' }
    });
  }

  // Fallback
  if (err) {
    log.error({ err: err.message || String(err) });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Unexpected server error.' }
    });
  }
  next();
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => log.info(`API up on :${PORT}`));
