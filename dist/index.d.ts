import { PluginOption } from 'vite';
import SVGSpriter from 'svg-sprite';

interface Options {
    /**
     * Input directory
     *
     * @default 'src/assets/images/svg/*.svg'
     */
    icons?: string;
    /**
     * Output directory
     *
     * @default 'src/public/images'
     */
    outputDir?: string;
    /**
     * sprite-svg {@link https://github.com/svg-sprite/svg-sprite/blob/main/docs/configuration.md#sprite-svg-options|options}
     */
    sprite?: SVGSpriter.Config;
}
declare function ViteSvgSpriteWrapper(options?: Options): PluginOption;

export { Options, ViteSvgSpriteWrapper as default };
