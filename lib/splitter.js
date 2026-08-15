const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

function splitDatabase(file, options = {}) {
  const {
    partSizeMB = 8,
    outputDir = path.dirname(file),
    baseName = path.basename(file),
    onSplit
  } = options

  if (!fs.existsSync(file)) {
    throw new Error('[split] Database file not found')
  }
  
  const manifestPath = path.join(
    outputDir,
    `${baseName}.manifest.json`
  )
  
  // 🔒 GUARD: sudah pernah split
  const overwrite = options.overwrite === true
  if (fs.existsSync(manifestPath) && !overwrite) {
    return
  }

  const partSize = Math.max(1024, Math.floor(partSizeMB * 1024 * 1024))
  const fd = fs.openSync(file, 'r')

  const stat = fs.statSync(file)
  const totalSize = stat.size
  const parts = Math.ceil(totalSize / partSize)

  const hash = crypto.createHash('sha256')
  let offset = 0

  for (let i = 0; i < parts; i++) {
    const partName = `${baseName}.part${String(i + 1).padStart(2, '0')}`
    const partPath = path.join(outputDir, partName)

    const size = Math.min(partSize, totalSize - offset)
    const buf = Buffer.alloc(size)

    fs.readSync(fd, buf, 0, size, offset)
    fs.writeFileSync(partPath, buf)

    hash.update(buf)
    offset += size
  }

  fs.closeSync(fd)

  const manifest = {
    name: baseName,
    parts,
    size: totalSize,
    checksum: {
      algo: 'sha256',
      value: hash.digest('hex')
    }
  }

  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  )

  onSplit?.({
    filename: file,
    parts,
    size: totalSize,
    manifest: manifestPath
  })
}

module.exports = { splitDatabase }