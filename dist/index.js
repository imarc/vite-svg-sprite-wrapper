// src/index.ts
import path, { resolve } from "path";
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { normalizePath } from "vite";
import picomatch from "picomatch";
import colors from "picocolors";
import SVGSpriter from "svg-sprite";
import FastGlob from "fast-glob";
var root = process.cwd();
var isSvg = /\.svg$/;
var useHash = (shape) => createHash("md5").update(shape).digest("hex").substring(0, 7);
function normalizePaths(root2, path2) {
  return (Array.isArray(path2) ? path2 : [path2]).map((path3) => resolve(root2, path3)).map(normalizePath);
}
var generateConfig = (outputDir, options) => ({
  dest: normalizePath(resolve(root, outputDir)),
  mode: {
    symbol: {
      sprite: "../sprite.svg"
    }
  },
  svg: {
    xmlDeclaration: false,
    rootAttributes: {
      style: "display: none;",
      focusable: "false"
    }
  },
  shape: {
    transform: [
      {
        svgo: {
          plugins: [
            { name: "preset-default" },
            "inlineStyles",
            "removeStyleElement",
            "removeScriptElement",
            "removeViewBox",
            {
              name: "removeAttrs",
              params: {
                attrs: ["*:(data-*|style|class):*"]
              }
            },
            "removeXMLNS"
          ]
        }
      }
    ]
  },
  variables: {
    kebab() {
      return function(text, render) {
        return render(text).match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map((x) => x.toLowerCase()).join("-");
      };
    }
  },
  ...options.sprite
});
async function generateSvgSprite(icons, outputDir, options, queryHash) {
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
  const output = result.symbol.sprite.path.replace(`${root}/`, "");
  const formattedOutput = `${output}?id=${useHash(result.symbol.sprite.contents.toString("utf8"))}`;
  const fileName = output.replace(/(.*\/)/gm, "");
  const dirPath = output.replace(fileName, "");
  readdirSync(dirPath).forEach((file) => {
    file.includes(fileName) && unlinkSync(dirPath + file);
  });
  Object.values(result.symbol).forEach((val) => {
    const value = val;
    mkdirSync(path.dirname(value.path), { recursive: true });
  });
  !queryHash && writeFileSync(
    output,
    result.symbol.sprite.contents.toString("utf8")
  );
  queryHash && writeFileSync(
    formattedOutput,
    result.symbol.sprite.contents.toString("utf8")
  );
  result.symbol.example && writeFileSync(
    result.symbol.example.path,
    result.symbol.example.contents.toString("utf8")
  );
  return {
    output: queryHash ? formattedOutput : output,
    example: result.symbol.example ? result.symbol.example.path.replace(`${root}/`, "") : null
  };
}
function ViteSvgSpriteWrapper(options = {}) {
  const {
    icons = "src/assets/images/svg/*.svg",
    outputDir = "src/public/images",
    queryHash = false
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
        generateSvgSprite(icons, outputDir, options, queryHash).then((res) => {
          config.logger.info(
            `${colors.green("sprite generated")} ${colors.dim(res.output)}`,
            {
              clear: true,
              timestamp: true
            }
          );
          res.example && config.logger.info(
            `${colors.green("sprite example generated")} ${colors.dim(res.example)}`,
            { clear: true, timestamp: true }
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
        generateSvgSprite(icons, outputDir, options, false).then((res) => {
          config.logger.info(
            `${colors.green("sprite generated")} ${colors.dim(res.output)}`,
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
        const checkReload = (path2) => {
          if (shouldReload(path2)) {
            schedule(() => {
              generateSvgSprite(icons, outputDir, options, false).then((res) => {
                ws.send({ type: "full-reload", path: "*" });
                logger.info(
                  `${colors.green("sprite changed")} ${colors.dim(res.output)}`,
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
