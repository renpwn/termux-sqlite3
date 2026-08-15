const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function sha256File(file) {
  const hash = crypto.createHash('sha256')
  const fd = fs.openSync(file, 'r')
  const buf = Buffer.alloc(1024 * 1024)
  let bytes

  while ((bytes = fs.readSync(fd, buf, 0, buf.length, null)) > 0) {
    hash.update(buf.subarray(0, bytes))
  }

  fs.closeSync(fd)
  return hash.digest('hex')
}

function ensureSplitDatabase(filename, options) {
  const {
    enabled,
    dir = path.dirname(filename),
    baseName = path.basename(filename),
    manifest = `${baseName}.manifest.json`,
    pattern = `${baseName}.part`,
    verify = true,
    checksum = 'sha256',
    mode = 'once',
    cleanup = false,
    decrypt,
    onRebuild
  } = options || {}

  if (!enabled) return

  const target = path.join(dir, baseName)
  const manifestPath = path.join(dir, manifest)

  const exists = fs.existsSync(target)

  if (mode === 'once' && exists) return
  if (mode === 'strict' && !fs.existsSync(manifestPath)) {
    throw new Error('[split] Manifest not found (strict mode)')
  }

  if (!fs.existsSync(manifestPath)) {
    if (mode === 'always') {
      if (exists) fs.unlinkSync(target)
    } else {
      return
    }
  }

  const meta = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

  const outFd = fs.openSync(target, 'w')

  try {
    for (let i = 1; i <= meta.parts; i++) {
      const partName = `${pattern}${String(i).padStart(2, '0')}`
      const partPath = path.join(dir, partName)

      if (!fs.existsSync(partPath)) {
        throw new Error(`[split] Missing part: ${partName}`)
      }

      let buf = fs.readFileSync(partPath)
      if (decrypt) buf = decrypt(buf, i - 1)

      fs.writeSync(outFd, buf, 0, buf.length)
    }
  } finally {
    fs.closeSync(outFd)
  }

  if (verify) {
    const stat = fs.statSync(target)
    if (meta.size && stat.size !== meta.size) {
      throw new Error('[split] Size mismatch after rebuild')
    }

    if (checksum && meta.checksum?.value) {
      const actual = sha256File(target)
      if (actual !== meta.checksum.value) {
        throw new Error('[split] Checksum mismatch')
      }
    }
  }

  if (cleanup) {
    for (let i = 1; i <= meta.parts; i++) {
      const partName = `${pattern}${String(i).padStart(2, '0')}`
      fs.unlinkSync(path.join(dir, partName))
    }
  }

  onRebuild?.({
    filename: target,
    parts: meta.parts,
    size: meta.size
  })
}

module.exports = { ensureSplitDatabase }