/**
 * Dish photo uploads.
 *
 * Files live on disk under `data/uploads/<yyyy-mm>/` and are served from
 * `/uploads/...`. They are deliberately *not* written into `dist/` — that folder
 * is generated, and a deploy would wipe the restaurant's photos.
 *
 * The extension is chosen by sniffing the file's magic bytes, never by trusting
 * the name or the browser-supplied Content-Type.
 */

import { Router } from 'express'
import multer from 'multer'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { requireRole } from '../lib/auth.js'
import { photoInUse } from '../db/repo.js'

const MAX_FILES = 8
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB per photo

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' }

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: MAX_FILES },
})

/** Real type from the first bytes of the file. */
export function sniffImage(buf) {
  if (!buf || buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  const head = buf.toString('ascii', 0, 6)
  if (head === 'GIF87a' || head === 'GIF89a') return 'image/gif'
  return null
}

const monthDir = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Filesystem path for a `/uploads/...` URL, or null if it escapes the folder. */
export function resolveUpload(uploadsDir, urlPath) {
  if (typeof urlPath !== 'string' || !urlPath.startsWith('/uploads/')) return null
  const rel = urlPath.slice('/uploads/'.length)
  if (!rel || rel.includes('\0')) return null
  const file = path.resolve(uploadsDir, rel)
  const root = path.resolve(uploadsDir)
  return file.startsWith(root + path.sep) ? file : null
}

/**
 * Delete uploaded files that no dish references any more.
 * Paths under `/assets/` are part of the app and are left alone.
 */
export function removeUploads(db, uploadsDir, paths) {
  const removed = []
  for (const p of paths || []) {
    if (!p || !p.startsWith('/uploads/')) continue
    if (photoInUse(db, p)) continue
    const file = resolveUpload(uploadsDir, p)
    if (!file) continue
    try {
      fs.rmSync(file, { force: true })
      removed.push(p)
    } catch { /* a locked or already-missing file is not worth failing a save */ }
  }
  return removed
}

const router = Router({ mergeParams: true })

/* ------------------------------- upload -------------------------------- */

router.post('/uploads', requireRole('owner', 'counter'), (req, res, next) => {
  upload.array('files', MAX_FILES)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `Each photo must be under ${MAX_BYTES / 1024 / 1024} MB` })
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: `Upload up to ${MAX_FILES} photos at a time` })
      }
      return next(err)
    }

    const files = req.files || []
    if (!files.length) return res.status(400).json({ error: 'No photo was sent' })

    // Check every file before writing any of them, so a mixed batch fails whole
    // and never leaves half the photos on disk.
    const checked = []
    for (const f of files) {
      const type = sniffImage(f.buffer)
      if (!type) {
        return res.status(400).json({ error: `"${f.originalname}" is not a JPG, PNG, WebP or GIF image` })
      }
      checked.push({ f, type })
    }

    const folder = monthDir()
    const dir = path.join(req.uploadsDir, folder)
    fs.mkdirSync(dir, { recursive: true })

    const saved = []
    for (const { f, type } of checked) {
      const name = randomUUID().replace(/-/g, '').slice(0, 20) + EXT[type]
      fs.writeFileSync(path.join(dir, name), f.buffer)
      saved.push({
        path: `/uploads/${folder}/${name}`,
        name: f.originalname,
        size: f.size,
        type,
      })
    }
    res.status(201).json({ files: saved })
  })
})

/* ------------------------- pick from the app --------------------------- */

router.get('/media', requireRole('owner', 'counter'), (req, res) => {
  const library = []
  const foodDir = path.join(req.publicDir, 'assets', 'food')
  try {
    for (const name of fs.readdirSync(foodDir)) {
      if (/\.(jpe?g|png|webp)$/i.test(name)) library.push(`/assets/food/${name}`)
    }
  } catch { /* no library folder on a bare deploy */ }

  const uploaded = []
  try {
    for (const sub of fs.readdirSync(req.uploadsDir)) {
      const dir = path.join(req.uploadsDir, sub)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const name of fs.readdirSync(dir)) {
        if (/\.(jpe?g|png|webp|gif)$/i.test(name)) uploaded.push(`/uploads/${sub}/${name}`)
      }
    }
  } catch { /* uploads folder is created on the first upload */ }

  // Newest uploads first — the photo just added is the one most likely wanted.
  uploaded.sort().reverse()
  res.json({ library, uploads: uploaded })
})

export default router
