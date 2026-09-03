import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import JSZip from 'jszip'

const outputDirectory = resolve(process.argv[2] ?? '/tmp/lento-store-demo')

const books = [
  {
    fileName: '山中一日.epub',
    title: '山中一日',
    author: '林野',
    color: '#315d4b',
    accent: '#d7b979',
    chapters: [
      {
        title: '清晨',
        paragraphs: [
          '天刚亮，檐下的雨已经停了。松针上留着细小的水珠，山路从雾里慢慢显出来。',
          '我把窗推开一半，风带着潮湿的木香进屋。桌上的书翻到昨天那一页，像是替人守住了一段未完的时间。',
          '远处有鸟叫，短短两声，随后又安静下来。这样的清晨不催促任何人，只让每件事回到它自己的速度。',
        ],
      },
      {
        title: '午后',
        paragraphs: [
          '午后的光落在纸上，字与字之间仿佛多出了一点空隙。读累时抬头，云影正从对面的山坡缓缓移过。',
          '茶凉了也没有关系。把一页读慢一点，常常比急着知道结尾更接近一本书。',
        ],
      },
      {
        title: '入夜',
        paragraphs: [
          '夜色沿着窗框沉下来，灯只照亮桌面。白天读过的句子在安静里重新浮现，像雨后石阶上留下的水光。',
          '合上书时，山风正好经过。一天没有发生什么大事，却被几页文字保存得很完整。',
        ],
      },
    ],
  },
  {
    fileName: '灯下短札.epub',
    title: '灯下短札',
    author: '周迟',
    color: '#704a3c',
    accent: '#edc88f',
    chapters: [
      {
        title: '第一封',
        paragraphs: [
          '写信的时候，城市刚刚安静下来。窗外还有一盏很远的灯，像一句迟迟没有落下的句号。',
          '愿你也能在忙碌之后，留下一小段不被催促的时间。',
        ],
      },
    ],
  },
  {
    fileName: '远岸来信.epub',
    title: '远岸来信',
    author: '沈舟',
    color: '#465b73',
    accent: '#d8c7a4',
    chapters: [
      {
        title: '潮声',
        paragraphs: [
          '潮水退去以后，沙滩上留下很长的纹路。海并不解释它带走了什么，只在下一次涨潮时重新抵达。',
          '我把这些写给你，希望信到达时，你正好有空读完。',
        ],
      },
    ],
  },
]

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function createCover(book) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="840" viewBox="0 0 600 840">
  <rect width="600" height="840" fill="${book.color}"/>
  <circle cx="510" cy="90" r="210" fill="${book.accent}" opacity=".2"/>
  <path d="M86 586c103 0 201 31 301 112v-184c-100-81-198-112-301-112v184Z" fill="#f5f2eb"/>
  <path d="M514 402c-42 0-84 8-127 25v271c43-35 85-63 127-79V402Z" fill="#f5f2eb" opacity=".94"/>
  <path d="M387 514v184" stroke="${book.color}" stroke-width="10" stroke-linecap="round"/>
  <text x="76" y="142" fill="#f5f2eb" font-family="serif" font-size="68" letter-spacing="8">${escapeXml(book.title)}</text>
  <text x="80" y="201" fill="#f5f2eb" opacity=".72" font-family="sans-serif" font-size="25" letter-spacing="5">${escapeXml(book.author)}</text>
</svg>`
}

async function createEpub(book, index) {
  const identifier = `urn:uuid:00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  )
  zip.file('OPS/cover.svg', createCover(book))
  zip.file(
    'OPS/styles.css',
    `body{max-width:42em;margin:0 auto;padding:8vh 8vw;color:#29332f;background:#f8f5ee;font-family:serif;line-height:1.95}h1{margin:0 0 2.5em;font-size:2em;font-weight:500;letter-spacing:.12em}p{margin:0 0 1.5em;text-indent:2em}`,
  )

  const chapterItems = book.chapters.map((chapter, chapterIndex) => {
    const chapterFile = `chapter-${chapterIndex + 1}.xhtml`
    zip.file(
      `OPS/${chapterFile}`,
      `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN"><head><title>${escapeXml(chapter.title)}</title><link rel="stylesheet" type="text/css" href="styles.css"/></head><body><h1>${escapeXml(chapter.title)}</h1>${chapter.paragraphs.map((paragraph) => `<p>${escapeXml(paragraph)}</p>`).join('')}</body></html>`,
    )
    return { chapter, chapterFile, id: `chapter-${chapterIndex + 1}` }
  })

  zip.file(
    'OPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN"><head><title>目录</title></head><body><nav epub:type="toc"><h1>目录</h1><ol>${chapterItems.map(({ chapter, chapterFile }) => `<li><a href="${chapterFile}">${escapeXml(chapter.title)}</a></li>`).join('')}</ol></nav></body></html>`,
  )
  zip.file(
    'OPS/package.opf',
    `<?xml version="1.0" encoding="utf-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">${identifier}</dc:identifier><dc:title>${escapeXml(book.title)}</dc:title><dc:creator>${escapeXml(book.author)}</dc:creator><dc:language>zh-CN</dc:language><meta property="dcterms:modified">2026-09-03T00:00:00Z</meta></metadata><manifest><item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="styles" href="styles.css" media-type="text/css"/>${chapterItems.map(({ chapterFile, id }) => `<item id="${id}" href="${chapterFile}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${chapterItems.map(({ id }) => `<itemref idref="${id}"/>`).join('')}</spine></package>`,
  )

  return zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
}

await mkdir(outputDirectory, { recursive: true })
for (const [index, book] of books.entries()) {
  await writeFile(join(outputDirectory, book.fileName), await createEpub(book, index))
}

console.log(`Created ${books.length} demo EPUBs in ${outputDirectory}`)
