import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { DEFAULT_SITE_URL, normalizeSiteUrl } from './src/seo/metadata.ts'

type BuildTarget = 'web' | 'extension'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const iconDirectory = join(projectRoot, 'public/icons')

function getBuildTarget(mode: string): BuildTarget {
  return mode === 'extension' ? 'extension' : 'web'
}

function getWebBasePath(): string {
  const configuredBase = process.env.LENTO_BASE_PATH?.trim() || '/'
  const withLeadingSlash = configuredBase.startsWith('/')
    ? configuredBase
    : `/${configuredBase}`
  return withLeadingSlash.endsWith('/')
    ? withLeadingSlash
    : `${withLeadingSlash}/`
}

function targetHtmlPlugin(target: BuildTarget, base: string): Plugin {
  return {
    name: 'lento-target-html',
    transformIndexHtml(html) {
      const webHead = `
    <link rel="icon" href="${base}icons/favicon.ico" sizes="32x32" />
    <link rel="icon" href="${base}icons/lento.svg" type="image/svg+xml" sizes="any" />
    <link rel="apple-touch-icon" href="${base}icons/lento-180.png" sizes="180x180" />
    <link rel="manifest" href="${base}manifest.webmanifest" />`

      return html.replace(
        '    <!-- LENTO_WEB_HEAD -->',
        target === 'web' ? webHead : '',
      )
    },
  }
}

function targetStaticAssetsPlugin(target: BuildTarget): Plugin {
  const manifestPath =
    target === 'extension'
      ? join(projectRoot, 'extension/manifest.json')
      : join(projectRoot, 'web/manifest.webmanifest')
  const manifestFileName =
    target === 'extension' ? 'manifest.json' : 'manifest.webmanifest'

  return {
    name: 'lento-target-static-assets',
    apply: 'build',
    buildStart() {
      for (const iconFileName of readdirSync(iconDirectory)) {
        this.emitFile({
          type: 'asset',
          fileName: `icons/${basename(iconFileName)}`,
          source: readFileSync(join(iconDirectory, iconFileName)),
        })
      }
      this.emitFile({
        type: 'asset',
        fileName: manifestFileName,
        source: readFileSync(manifestPath),
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const target = getBuildTarget(mode)
  const base = target === 'web' ? getWebBasePath() : '/'
  const plugins = [
    react(),
    targetHtmlPlugin(target, base),
    targetStaticAssetsPlugin(target),
  ]

  return {
    base,
    publicDir: false,
    plugins,
    define: {
      __LENTO_BUILD_TARGET__: JSON.stringify(target),
      __LENTO_SITE_URL__: JSON.stringify(normalizeSiteUrl(process.env.LENTO_SITE_URL || DEFAULT_SITE_URL)),
    },
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      rollupOptions: {
        input:
          target === 'extension'
            ? {
                index: fileURLToPath(
                  new URL('./index.html', import.meta.url),
                ),
                background: fileURLToPath(
                  new URL('./src/background.ts', import.meta.url),
                ),
              }
            : fileURLToPath(new URL('./index.html', import.meta.url)),
        output: {
          entryFileNames: (chunkInfo) =>
            chunkInfo.name === 'background'
              ? 'background.js'
              : 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
  }
})
