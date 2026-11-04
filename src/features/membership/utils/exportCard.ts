import { toPng } from 'html-to-image';

const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Renders the story frame off-screen at full 1080x1920 resolution (ignoring the
 * preview scale) and returns a PNG data URL, ready for the native share bridge.
 * Always call this against a dedicated hidden full-scale <StoryShareFrame> node.
 */
export async function exportCardAsPng(node: HTMLElement): Promise<string> {
  // Give the logo a chance to load so it is inlined into the raster.
  await new Promise((r) => setTimeout(r, 60));
  return toPng(node, {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    pixelRatio: 1,
    cacheBust: true,
    style: { transform: 'none' },
  });
}

