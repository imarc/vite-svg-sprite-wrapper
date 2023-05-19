// src/index.ts
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { normalizePath } from "vite";
import picomatch from "picomatch";
import colors from "picocolors";
import SVGSpriter from "svg-sprite";
import FastGlob from "fast-glob";
var root = process.cwd();
var isSvg = /\.svg$/;
function normalizePaths(root2, path) {
  return (Array.isArray(path) ? path : [path]).map((path2) => resolve(root2, path2)).map(normalizePath);
}
var generateConfig = (outputDir, options) => ({
  dest: normalizePath(resolve(root, outputDir)),
  mode: {
    symbol: {
      sprite: "../sprite.svg"
    }
  },
  svg: {
    xmlDeclaration: false
  },
  shape: {
    transform: [
      {
        svgo: {
          plugins: [
            { name: "preset-default" },
            {
              name: "removeAttrs",
              params: {
                attrs: ["*:(data-*|style|fill):*"]
              }
            },
            {
              name: "addAttributesToSVGElement",
              params: {
                attributes: [
                  { fill: "currentColor" }
                ]
              }
            },
            "removeXMLNS"
          ]
        }
      }
    ]
  },
  ...options.sprite
});
async function generateSvgSprite(icons, outputDir, options) {
  const spriter = new SVGSpriter(generateConfig(outputDir, options));
  const rootDir = icons.replace(/(\/(\*+))+\.(.+)/g, "");
  const entries = await FastGlob([icons]);
  for (const entry of entries) {
    if (isSvg.test(entry)) {
      const relativePath = entry.replace(`${rootDir}/`, "");
      spriter.add(
        entry,
        relativePath,
        readFileSync(entry, { encoding: "utf-8" })
      );
    }
  }
  const { result } = await spriter.compileAsync();
  writeFileSync(
    result.symbol.sprite.path,
    result.symbol.sprite.contents.toString("utf8")
  );
  return result.symbol.sprite.path.replace(`${root}/`, "");
}
function ViteSvgSpriteWrapper(options = {}) {
  const {
    icons = "src/assets/images/svg/*.svg",
    outputDir = "src/public/images"
  } = options;
  let timer;
  let config;
  function clear() {
    clearTimeout(timer);
  }
  function schedule(fn) {
    clear();
    timer = setTimeout(fn, 200);
  }
  return [
    {
      name: "vite-plugin-svg-sprite:build",
      apply: "build",
      configResolved(_config) {
        config = _config;
      },
      async writeBundle() {
        generateSvgSprite(icons, outputDir, options).then((res) => {
          config.logger.info(
            `${colors.green("sprite generated")} ${colors.dim(res)}`,
            {
              clear: true,
              timestamp: true
            }
          );
        }).catch((err) => {
          config.logger.info(
            `${colors.red("sprite error")} ${colors.dim(err)}`,
            { clear: true, timestamp: true }
          );
        });
      }
    },
    {
      name: "vite-plugin-svg-sprite:serve",
      apply: "serve",
      configResolved(_config) {
        config = _config;
      },
      async buildStart() {
        generateSvgSprite(icons, outputDir, options).then((res) => {
          config.logger.info(
            `${colors.green("sprite generated")} ${colors.dim(res)}`,
            {
              clear: true,
              timestamp: true
            }
          );
        }).catch((err) => {
          config.logger.info(
            `${colors.red("sprite error")} ${colors.dim(err)}`,
            { clear: true, timestamp: true }
          );
        });
      },
      config: () => ({ server: { watch: { disableGlobbing: false } } }),
      configureServer({ watcher, ws, config: { logger } }) {
        const iconsPath = normalizePaths(root, icons);
        const shouldReload = picomatch(iconsPath);
        const checkReload = (path) => {
          if (shouldReload(path)) {
            schedule(() => {
              generateSvgSprite(icons, outputDir, options).then((res) => {
                ws.send({ type: "full-reload", path: "*" });
                logger.info(
                  `${colors.green("sprite changed")} ${colors.dim(res)}`,
                  {
                    clear: true,
                    timestamp: true
                  }
                );
              }).catch((err) => {
                logger.info(
                  `${colors.red("sprite error")} ${colors.dim(err)}`,
                  { clear: true, timestamp: true }
                );
              });
            });
          }
        };
        watcher.add(iconsPath);
        watcher.on("add", checkReload);
        watcher.on("change", checkReload);
        watcher.on("unlink", checkReload);
      }
    }
  ];
}
var src_default = ViteSvgSpriteWrapper;
export {
  src_default as default
};
