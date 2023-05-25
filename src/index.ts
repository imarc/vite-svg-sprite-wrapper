/* eslint-disable @typescript-eslint/consistent-type-imports */
import path, { resolve } from 'path'
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { type PluginOption, ResolvedConfig, type ViteDevServer, normalizePath } from 'vite'
import picomatch from 'picomatch'
import colors from 'picocolors'
import SVGSpriter from 'svg-sprite'
import FastGlob from 'fast-glob'

export interface Options {
  /**
     * Input directory
     *
     * @default 'src/assets/images/svg/*.svg'
     */
  icons?: string
  /**
     * Output directory
     *
     * @default 'src/public/images'
     */
  outputDir?: string

  /**
     * sprite-svg {@link https://github.com/svg-sprite/svg-sprite/blob/main/docs/configuration.md#sprite-svg-options|options}
     */
  sprite?: SVGSpriter.Config

  /**
     * Add Query Hash
     *
     * @default false
     */
  queryHash?: boolean

}

export interface ResolveObject {
  output: string
  example: string | null
  scss: string | null
  css: string | null
}

const root = process.cwd()
const isSvg = /\.svg$/

const useHash = (shape: string) => createHash('md5')
  .update(shape)
  .digest('hex')
  .substring(0, 7)

function normalizePaths(root: string, path: string | undefined): string[] {
  return (Array.isArray(path) ? path : [path])
    .map(path => resolve(root, path))
    .map(normalizePath)
}

const generateConfig = (outputDir: string, options: Options) => ({
  dest: normalizePath(resolve(root, outputDir)),
  mode: {
    symbol: {
      sprite: '../sprite.svg',
    },
  },
  svg: {
    xmlDeclaration: false,
    rootAttributes: {
      style: 'display: none;',
      focusable: 'false',
    },
  },
  shape: {
    transform: [
      {
        svgo: {
          plugins: [
            { name: 'preset-default' },
            'inlineStyles',
            'removeStyleElement',
            'removeScriptElement',
            'removeViewBox',
            {
              name: 'removeAttrs',
              params: {
                attrs: ['*:(data-*|style|class):*'],
              },
            },
            'removeXMLNS',
          ],
        },
      },
    ],
  },
  variables: {
    kebab() {
      return function (text: string, render: Function) {
        return render(text)
          .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
          .map((x: string) => x.toLowerCase())
          .join('-')
      }
    },
  },
  ...options.sprite,
})

async function generateSvgSprite(icons: string, outputDir: string, options: Options, queryHash: boolean): Promise<ResolveObject> {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const spriter = new SVGSpriter(generateConfig(outputDir, options))
  const rootDir = icons.replace(/(\/(\*+))+\.(.+)/g, '')
  const entries = await FastGlob([icons])

  for (const entry of entries) {
    if (isSvg.test(entry)) {
      const relativePath = entry.replace(`${rootDir}/`, '')
      spriter.add(
        entry,
        relativePath,
        readFileSync(entry, { encoding: 'utf-8' }),
      )
    }
  }

  const { result } = await spriter.compileAsync()

  const output = result.symbol.sprite.path.replace(`${root}/`, '')
  const formattedOutput = `${output}?id=${useHash(result.symbol.sprite.contents.toString('utf8'))}`
  const fileName = output.replace(/(.*\/)/gm, '')
  const dirPath = output.replace(fileName, '')

  // remove all version of file before creating new versions
  readdirSync(dirPath).forEach((file) => {
    file.includes(fileName) && unlinkSync(dirPath + file)
  })

  // create directory if not exist
  Object.values(result.symbol).forEach((val) => {
    const value = val as { path: string }
    mkdirSync(path.dirname(value.path), { recursive: true })
  })

  // write output
  !queryHash && writeFileSync(
    output,
    result.symbol.sprite.contents.toString('utf8'),
  )

  // if queryHash, write queryHashed output
  queryHash && writeFileSync(
    formattedOutput,
    result.symbol.sprite.contents.toString('utf8'),
  )

  // if example, write example output
  result.symbol.example && writeFileSync(
    result.symbol.example.path,
    result.symbol.example.contents.toString('utf8'),
  )

  result.symbol.scss && writeFileSync(
    result.symbol.scss.path,
    result.symbol.scss.contents.toString('utf8'),
  )

  result.symbol.css && writeFileSync(
    result.symbol.css.path,
    result.symbol.css.contents.toString('utf8'),
  )

  return {
    output: queryHash ? formattedOutput : output,
    example: result.symbol.example ? result.symbol.example.path.replace(`${root}/`, '') : null,
    scss: result.symbol.scss ? result.symbol.scss.path.replace(`${root}/`, '') : null,
    css: result.symbol.css ? result.symbol.css.path.replace(`${root}/`, '') : null,
  }
}

function ViteSvgSpriteWrapper(options: Options = {}): PluginOption {
  const {
    icons = 'src/assets/images/svg/*.svg',
    outputDir = 'src/public/images',
    queryHash = false,
  } = options
  let timer: number | undefined
  let config: ResolvedConfig

  function clear() {
    clearTimeout(timer)
  }
  function schedule(fn: () => void) {
    clear()
    timer = setTimeout(fn, 200) as any as number
  }

  return [
    {
      name: 'vite-plugin-svg-sprite:build',
      apply: 'build',
      configResolved(_config) {
        config = _config
      },
      async writeBundle() {
        generateSvgSprite(icons, outputDir, options, queryHash)
          .then((res) => {
            config.logger.info(
                        `${colors.green('sprite generated')} ${colors.dim(res.output)}`,
                        {
                          clear: true,
                          timestamp: true,
                        },
            )
            res.example && config.logger.info(
                        `${colors.green('sprite example generated')} ${colors.dim(res.example)}`,
                        { clear: true, timestamp: true },
            )
            res.scss && config.logger.info(
              `${colors.green('sprite scss generated')} ${colors.dim(res.scss)}`,
              { clear: true, timestamp: true },
            )

            res.css && config.logger.info(
              `${colors.green('sprite css generated')} ${colors.dim(res.css)}`,
              { clear: true, timestamp: true },
            )
          })
          .catch((err) => {
            config.logger.info(
                        `${colors.red('sprite error')} ${colors.dim(err)}`,
                        { clear: true, timestamp: true },
            )
          })
      },
    },
    {
      name: 'vite-plugin-svg-sprite:serve',
      apply: 'serve',
      configResolved(_config) {
        config = _config
      },
      async buildStart() {
        generateSvgSprite(icons, outputDir, options, false)
          .then((res) => {
            config.logger.info(
                        `${colors.green('sprite generated')} ${colors.dim(res.output)}`,
                        {
                          clear: true,
                          timestamp: true,
                        },
            )
          })
          .catch((err) => {
            config.logger.info(
                        `${colors.red('sprite error')} ${colors.dim(err)}`,
                        { clear: true, timestamp: true },
            )
          })
      },
      config: () => ({ server: { watch: { disableGlobbing: false } } }),
      configureServer({ watcher, ws, config: { logger } }: ViteDevServer) {
        const iconsPath = normalizePaths(root, icons)
        const shouldReload = picomatch(iconsPath)
        const checkReload = (path: string) => {
          if (shouldReload(path)) {
            schedule(() => {
              generateSvgSprite(icons, outputDir, options, false)
                .then((res) => {
                  ws.send({ type: 'full-reload', path: '*' })
                  logger.info(
                                        `${colors.green('sprite changed')} ${colors.dim(res.output)}`,
                                        {
                                          clear: true,
                                          timestamp: true,
                                        },
                  )
                })
                .catch((err) => {
                  logger.info(
                                        `${colors.red('sprite error')} ${colors.dim(err)}`,
                                        { clear: true, timestamp: true },
                  )
                })
            })
          }
        }

        watcher.add(iconsPath)
        watcher.on('add', checkReload)
        watcher.on('change', checkReload)
        watcher.on('unlink', checkReload)
      },
    },
  ]
}

export default ViteSvgSpriteWrapper
