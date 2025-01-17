"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  default: () => src_default
});
module.exports = __toCommonJS(src_exports);
var import_path = __toESM(require("path"), 1);
var import_fs = require("fs");
var import_crypto = require("crypto");
var import_vite = require("vite");
var import_picomatch = __toESM(require("picomatch"), 1);
var import_picocolors = __toESM(require("picocolors"), 1);
var import_svg_sprite = __toESM(require("svg-sprite"), 1);
var import_fast_glob = __toESM(require("fast-glob"), 1);
var root = process.cwd();
var isSvg = /\.svg$/;
var useHash = (shape) => (0, import_crypto.createHash)("md5").update(shape).digest("hex").substring(0, 7);
function normalizePaths(root2, path2) {
  return (Array.isArray(path2) ? path2 : [path2]).map((path3) => (0, import_path.resolve)(root2, path3)).map(import_vite.normalizePath);
}
var generateConfig = (outputDir, options) => ({
  dest: (0, import_vite.normalizePath)((0, import_path.resolve)(root, outputDir)),
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
  const spriter = new import_svg_sprite.default(generateConfig(outputDir, options));
  const rootDir = icons.replace(/(\/(\*+))+\.(.+)/g, "");
  const entries = await (0, import_fast_glob.default)([icons]);
  for (const entry of entries) {
    if (isSvg.test(entry)) {
      const relativePath = entry.replace(`${rootDir}/`, "");
      spriter.add(
        entry,
        relativePath,
        (0, import_fs.readFileSync)(entry, { encoding: "utf-8" })
      );
    }
  }
  const { result } = await spriter.compileAsync();
  const output = result.symbol.sprite.path.replace(`${root}/`, "");
  const formattedOutput = `${output}?id=${useHash(result.symbol.sprite.contents.toString("utf8"))}`;
  const fileName = output.replace(/(.*\/)/gm, "");
  const dirPath = output.replace(fileName, "");
  (0, import_fs.readdirSync)(dirPath).forEach((file) => {
    file.includes(fileName) && (0, import_fs.unlinkSync)(dirPath + file);
  });
  Object.values(result.symbol).forEach((val) => {
    const value = val;
    (0, import_fs.mkdirSync)(import_path.default.dirname(value.path), { recursive: true });
  });
  !queryHash && (0, import_fs.writeFileSync)(
    output,
    result.symbol.sprite.contents.toString("utf8")
  );
  queryHash && (0, import_fs.writeFileSync)(
    formattedOutput,
    result.symbol.sprite.contents.toString("utf8")
  );
  result.symbol.example && (0, import_fs.writeFileSync)(
    result.symbol.example.path,
    result.symbol.example.contents.toString("utf8")
  );
  result.symbol.scss && (0, import_fs.writeFileSync)(
    result.symbol.scss.path,
    result.symbol.scss.contents.toString("utf8")
  );
  result.symbol.css && (0, import_fs.writeFileSync)(
    result.symbol.css.path,
    result.symbol.css.contents.toString("utf8")
  );
  return {
    output: queryHash ? formattedOutput : output,
    example: result.symbol.example ? result.symbol.example.path.replace(`${root}/`, "") : null,
    scss: result.symbol.scss ? result.symbol.scss.path.replace(`${root}/`, "") : null,
    css: result.symbol.css ? result.symbol.css.path.replace(`${root}/`, "") : null
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
            `${import_picocolors.default.green("sprite generated")} ${import_picocolors.default.dim(res.output)}`,
            {
              clear: true,
              timestamp: true
            }
          );
          res.example && config.logger.info(
            `${import_picocolors.default.green("sprite example generated")} ${import_picocolors.default.dim(res.example)}`,
            { clear: true, timestamp: true }
          );
          res.scss && config.logger.info(
            `${import_picocolors.default.green("sprite scss generated")} ${import_picocolors.default.dim(res.scss)}`,
            { clear: true, timestamp: true }
          );
          res.css && config.logger.info(
            `${import_picocolors.default.green("sprite css generated")} ${import_picocolors.default.dim(res.css)}`,
            { clear: true, timestamp: true }
          );
        }).catch((err) => {
          config.logger.info(
            `${import_picocolors.default.red("sprite error")} ${import_picocolors.default.dim(err)}`,
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
            `${import_picocolors.default.green("sprite generated")} ${import_picocolors.default.dim(res.output)}`,
            {
              clear: true,
              timestamp: true
            }
          );
        }).catch((err) => {
          config.logger.info(
            `${import_picocolors.default.red("sprite error")} ${import_picocolors.default.dim(err)}`,
            { clear: true, timestamp: true }
          );
        });
      },
      config: () => ({ server: { watch: { disableGlobbing: false } } }),
      configureServer({ watcher, ws, config: { logger } }) {
        const iconsPath = normalizePaths(root, icons);
        const shouldReload = (0, import_picomatch.default)(iconsPath);
        const checkReload = (path2) => {
          if (shouldReload(path2)) {
            schedule(() => {
              generateSvgSprite(icons, outputDir, options, false).then((res) => {
                ws.send({ type: "full-reload", path: "*" });
                logger.info(
                  `${import_picocolors.default.green("sprite changed")} ${import_picocolors.default.dim(res.output)}`,
                  {
                    clear: true,
                    timestamp: true
                  }
                );
              }).catch((err) => {
                logger.info(
                  `${import_picocolors.default.red("sprite error")} ${import_picocolors.default.dim(err)}`,
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
