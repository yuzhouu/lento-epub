import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join, relative, resolve, sep } from 'node:path'
import JSZip from 'jszip'

const projectRoot = resolve(import.meta.dirname, '..')
const extensionDirectory = join(projectRoot, 'dist', 'extension')
const releaseDirectory = join(projectRoot, 'release', 'chrome-web-store')

async function listFiles(directory) {
  const entries = await readdir(directory)
  const files = []

  for (const entry of entries.sort()) {
    const path = join(directory, entry)
    const metadata = await stat(path)
    if (metadata.isDirectory()) files.push(...(await listFiles(path)))
    else files.push(path)
  }

  return files
}

function toZipPath(path) {
  return relative(extensionDirectory, path).split(sep).join('/')
}

const [manifestSource, packageSource] = await Promise.all([
  readFile(join(extensionDirectory, 'manifest.json'), 'utf8'),
  readFile(join(projectRoot, 'package.json'), 'utf8'),
])
const manifest = JSON.parse(manifestSource)
const packageJson = JSON.parse(packageSource)

if (manifest.manifest_version !== 3) {
  throw new Error('Chrome Web Store 发布包必须使用 Manifest V3。')
}
if (manifest.version !== packageJson.version) {
  throw new Error(
    `版本不一致：manifest=${manifest.version}，package=${packageJson.version}`,
  )
}

const files = await listFiles(extensionDirectory)
const zip = new JSZip()
for (const path of files) {
  const zipPath = toZipPath(path)
  if (basename(path) === '.DS_Store' || zipPath.endsWith('.map')) continue
  zip.file(zipPath, await readFile(path))
}

const archive = await zip.generateAsync({
  type: 'nodebuffer',
  platform: 'UNIX',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
})
const verifiedArchive = await JSZip.loadAsync(archive)
const packagedFiles = Object.keys(verifiedArchive.files).filter(
  (fileName) => !verifiedArchive.files[fileName].dir,
)

if (!verifiedArchive.file('manifest.json')) {
  throw new Error('发布包根目录缺少 manifest.json。')
}
if (!verifiedArchive.file('index.html') || !verifiedArchive.file('background.js')) {
  throw new Error('发布包缺少扩展入口文件。')
}

await mkdir(releaseDirectory, { recursive: true })
const outputPath = join(
  releaseDirectory,
  `lento-epub-reader-${manifest.version}.zip`,
)
await writeFile(outputPath, archive)

console.log(`Created ${relative(projectRoot, outputPath)}`)
console.log(
  `Version ${manifest.version}, ${packagedFiles.length} files, ${archive.byteLength} bytes`,
)
