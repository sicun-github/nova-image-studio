import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { GIF_GRID_COLS, GIF_GRID_ROWS } from '@/lib/gif-job-store';

export interface EncodeGifOptions {
  frameDelayMs: number;
  /** 0 = 无限循环；正整数 = 循环 N 次；负数 = 仅播放一次（不循环） */
  repeat: number;
  /** 用户自定义内缩百分比（0-5），从每帧四周等比例裁掉 */
  framePaddingPercent?: number;
  /** 自动检测主体边界并把主体对齐到画布中心 */
  autoAlignFrames?: boolean;
}

export interface GridCell {
  index: number;
  /** PNG dataURL，供微调器以 <img> 渲染 */
  dataUrl: string;
  width: number;
  height: number;
}

export interface ExtractedGrid {
  cells: GridCell[];
  cellWidth: number;
  cellHeight: number;
}

interface FrameSource {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('网格图加载失败，无法切帧'));
    img.src = src;
  });
}

function createCanvasContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('当前浏览器不支持 Canvas 2D，无法合成 GIF');
  }
  return ctx;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function colorDistance(data: Uint8ClampedArray, index: number, color: RgbColor): number {
  const dr = data[index] - color.r;
  const dg = data[index + 1] - color.g;
  const db = data[index + 2] - color.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function estimateBackgroundColor(data: Uint8ClampedArray, width: number, height: number): RgbColor {
  const samples: [number, number][] = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
    [Math.floor(width / 2), 0],
    [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)],
  ];
  const total = samples.reduce((acc, [x, y]) => {
    const index = (y * width + x) * 4;
    acc.r += data[index];
    acc.g += data[index + 1];
    acc.b += data[index + 2];
    return acc;
  }, { r: 0, g: 0, b: 0 });

  return {
    r: Math.round(total.r / samples.length),
    g: Math.round(total.g / samples.length),
    b: Math.round(total.b / samples.length),
  };
}

function alignFrameToSubject(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const background = estimateBackgroundColor(data, width, height);
  const threshold = 26;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foregroundPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (data[index + 3] > 12 && colorDistance(data, index, background) > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        foregroundPixels++;
      }
    }
  }

  if (foregroundPixels === 0) return imageData;

  const subjectW = maxX - minX + 1;
  const subjectH = maxY - minY + 1;
  const foregroundRatio = foregroundPixels / (width * height);
  if (
    foregroundRatio > 0.82
    || subjectW > width * 0.92
    || subjectH > height * 0.92
    || subjectW < width * 0.12
    || subjectH < height * 0.12
  ) {
    return imageData;
  }

  const subjectCenterX = (minX + maxX) / 2;
  const subjectCenterY = (minY + maxY) / 2;
  const maxShiftX = Math.round(width * 0.18);
  const maxShiftY = Math.round(height * 0.18);
  const shiftX = clamp(Math.round(width / 2 - subjectCenterX), -maxShiftX, maxShiftX);
  const shiftY = clamp(Math.round(height / 2 - subjectCenterY), -maxShiftY, maxShiftY);

  if (Math.abs(shiftX) <= 1 && Math.abs(shiftY) <= 1) return imageData;

  const aligned = new ImageData(width, height);
  for (let index = 0; index < aligned.data.length; index += 4) {
    aligned.data[index] = background.r;
    aligned.data[index + 1] = background.g;
    aligned.data[index + 2] = background.b;
    aligned.data[index + 3] = 255;
  }

  for (let y = 0; y < height; y++) {
    const targetY = y + shiftY;
    if (targetY < 0 || targetY >= height) continue;
    for (let x = 0; x < width; x++) {
      const targetX = x + shiftX;
      if (targetX < 0 || targetX >= width) continue;
      const sourceIndex = (y * width + x) * 4;
      const targetIndex = (targetY * width + targetX) * 4;
      aligned.data[targetIndex] = data[sourceIndex];
      aligned.data[targetIndex + 1] = data[sourceIndex + 1];
      aligned.data[targetIndex + 2] = data[sourceIndex + 2];
      aligned.data[targetIndex + 3] = data[sourceIndex + 3];
    }
  }

  return aligned;
}

/**
 * 固定切割：网格图分辨率受严格约束（3264×2448，4×3），直接按行列等分即可。
 * paddingPercent 从每格四周等比例内缩，去掉模型可能渗到边缘的少量噪声。
 */
function computeFixedFrameSources(
  naturalWidth: number,
  naturalHeight: number,
  paddingPercent: number,
): { sources: FrameSource[]; cellW: number; cellH: number } {
  const baseCellW = Math.floor(naturalWidth / GIF_GRID_COLS);
  const baseCellH = Math.floor(naturalHeight / GIF_GRID_ROWS);
  if (baseCellW <= 0 || baseCellH <= 0) {
    throw new Error('网格图过小，无法切出 3×4 帧');
  }

  const pct = clamp(paddingPercent, 0, 5);
  const insetX = Math.round((baseCellW * pct) / 100);
  const insetY = Math.round((baseCellH * pct) / 100);
  const cellW = Math.max(8, baseCellW - insetX * 2);
  const cellH = Math.max(8, baseCellH - insetY * 2);

  const sources: FrameSource[] = [];
  for (let row = 0; row < GIF_GRID_ROWS; row++) {
    for (let col = 0; col < GIF_GRID_COLS; col++) {
      sources.push({
        sx: col * baseCellW + insetX,
        sy: row * baseCellH + insetY,
        sw: cellW,
        sh: cellH,
      });
    }
  }
  return { sources, cellW, cellH };
}

/**
 * 核心编码：把一组等尺寸帧像素合成 GIF。
 * 合并全部帧做一次全局量化，保证整段动画调色板一致。
 */
function encodeFramesToBlob(
  frames: Uint8ClampedArray[],
  width: number,
  height: number,
  options: EncodeGifOptions,
): Blob {
  if (frames.length === 0) {
    throw new Error('没有可编码的帧');
  }

  const pixelsPerFrame = width * height * 4;
  const merged = new Uint8ClampedArray(pixelsPerFrame * frames.length);
  frames.forEach((f, i) => merged.set(f, i * pixelsPerFrame));
  const palette = quantize(merged, 256, { format: 'rgb565' });

  const gif = GIFEncoder();
  frames.forEach((data, i) => {
    const indexed = applyPalette(data, palette);
    if (i === 0) {
      gif.writeFrame(indexed, width, height, {
        palette,
        delay: options.frameDelayMs,
        repeat: options.repeat,
        dispose: 2,
      });
    } else {
      gif.writeFrame(indexed, width, height, {
        delay: options.frameDelayMs,
        dispose: 2,
      });
    }
  });

  gif.finish();
  const view = gif.bytes();
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return new Blob([copy], { type: 'image/gif' });
}

/**
 * 自动模式：固定切割网格图为 12 帧并直接合成 GIF。
 */
export async function encodeGifFromGrid(
  gridImageUrl: string,
  options: EncodeGifOptions,
): Promise<Blob> {
  const img = await loadImageElement(gridImageUrl);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error('网格图无效，尺寸为 0');
  }

  const { sources, cellW, cellH } = computeFixedFrameSources(
    naturalWidth,
    naturalHeight,
    options.framePaddingPercent ?? 0,
  );

  const frameCtx = createCanvasContext(cellW, cellH);
  const frames: Uint8ClampedArray[] = [];
  for (const src of sources) {
    const safeSx = clamp(src.sx, 0, naturalWidth - cellW);
    const safeSy = clamp(src.sy, 0, naturalHeight - cellH);
    frameCtx.clearRect(0, 0, cellW, cellH);
    frameCtx.drawImage(img, safeSx, safeSy, cellW, cellH, 0, 0, cellW, cellH);
    const frame = frameCtx.getImageData(0, 0, cellW, cellH);
    frames.push((options.autoAlignFrames === false ? frame : alignFrameToSubject(frame)).data);
  }

  return encodeFramesToBlob(frames, cellW, cellH, options);
}

/**
 * 微调模式第一步：固定切割网格图为 12 个独立单元格（不做内缩），
 * 返回每帧 PNG dataURL 供全屏编辑器渲染与对齐。
 */
export async function extractGridCells(gridImageUrl: string): Promise<ExtractedGrid> {
  const img = await loadImageElement(gridImageUrl);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new Error('网格图无效，尺寸为 0');
  }

  const { sources, cellW, cellH } = computeFixedFrameSources(naturalWidth, naturalHeight, 0);
  const ctx = createCanvasContext(cellW, cellH);
  const cells: GridCell[] = sources.map((src, index) => {
    const safeSx = clamp(src.sx, 0, naturalWidth - cellW);
    const safeSy = clamp(src.sy, 0, naturalHeight - cellH);
    ctx.clearRect(0, 0, cellW, cellH);
    ctx.drawImage(img, safeSx, safeSy, cellW, cellH, 0, 0, cellW, cellH);
    return {
      index,
      dataUrl: ctx.canvas.toDataURL('image/png'),
      width: cellW,
      height: cellH,
    };
  });

  return { cells, cellWidth: cellW, cellHeight: cellH };
}

/**
 * 微调模式第二步：把编辑器已合成好的等尺寸帧编码成 GIF。
 */
export function encodeFramesToGif(
  frames: ImageData[],
  options: EncodeGifOptions,
): Blob {
  if (frames.length === 0) {
    throw new Error('没有可编码的帧');
  }
  const { width, height } = frames[0];
  return encodeFramesToBlob(frames.map(f => f.data), width, height, options);
}

export function triggerGifDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
