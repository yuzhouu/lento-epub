import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const assetsDirectory = join(projectRoot, 'store', 'assets')

function getPngSize(data, fileName) {
  const signature = data.subarray(0, 8).toString('hex')
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${fileName} 不是有效的 PNG 文件。`)
  }
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
  }
}

async function assertSize(fileName, expectedWidth, expectedHeight) {
  const data = await readFile(join(assetsDirectory, fileName))
  const { width, height } = getPngSize(data, fileName)
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(
      `${fileName} 尺寸为 ${width}×${height}，期望 ${expectedWidth}×${expectedHeight}。`,
    )
  }
}

const assetNames = await readdir(assetsDirectory)
const screenshots = assetNames.filter((fileName) =>
  /^screenshot-.+-1280x800\.png$/.test(fileName),
)

if (screenshots.length === 0 || screenshots.length > 5) {
  throw new Error(`商店截图数量必须为 1–5 张，当前为 ${screenshots.length} 张。`)
}

await Promise.all([
  assertSize('icon-128.png', 128, 128),
  assertSize('promo-small-440x280.png', 440, 280),
  ...screenshots.map((fileName) => assertSize(fileName, 1280, 800)),
])

console.log(`Store assets OK: ${screenshots.length} screenshots, icon and promo tile`)
