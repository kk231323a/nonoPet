import { existsSync, mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceDir = path.join(
  workspaceRoot,
  "work",
  "wechat-stickers-latest",
  "decrypted",
  "Persist"
);
const targetDir = path.join(projectRoot, "src", "assets", "bubu-animated");
const tempDir = path.join(workspaceRoot, "work", "wxgf-temp");
const ffmpeg =
  process.env.FFMPEG_BIN ??
  path.join(workspaceRoot, "work", "ffmpeg-static", "ffmpeg.exe");

const stickers = {
  idle: "afbb39c42fc7c155fc6f8a4fb5aad163",
  pat: "91d306a530afc414cedbd3d4f478bee3",
  sleep: "90d6cb7dc34633886727308ed1a7d96c",
  drag: "1660a132eb4a695719efe4eca9905eac",
  greet: "77e8758463556d2f8b0c487b7e44e4da",
  angry: "f2eaa87c85a92a9a2d49d96b5510c30a",
  cry: "be988d776a754c115dd74c2439deab3b",
  hugSmall: "a2ad1883185efae86dd3cce81495a7b3",
  hug: "2ba9d293f894e434e12ecdc5aa2ef9a3"
};

// kiss.webp is converted from the original two-frame GIF saved as
// src/assets/bubu-source/kiss.gif, not from a business/emoticon wxgf file.

const playbackPace = {
  idle: 2.4,
  pat: 2.4,
  sleep: 2.8,
  drag: 1,
  greet: 3,
  angry: 6,
  cry: 6,
  hugSmall: 4,
  hug: 1.2
};

function stripWxgfHeader(data) {
  if (
    data[0] !== 0x77 ||
    data[1] !== 0x78 ||
    data[2] !== 0x67 ||
    data[3] !== 0x66
  ) {
    return data;
  }
  const markers = [
    Buffer.from([0, 0, 0, 1, 0x40, 0x01]),
    Buffer.from([0, 0, 0, 1, 0x42, 0x01])
  ];
  const offsets = markers
    .map((marker) => data.indexOf(marker))
    .filter((offset) => offset >= 0);
  return offsets.length ? data.subarray(Math.min(...offsets)) : data;
}

function removeConnectedBackground(data, width, height) {
  const cornerOffsets = [
    0,
    width - 1,
    (height - 1) * width,
    height * width - 1
  ];
  const background = cornerOffsets.reduce(
    (sum, pixelIndex) => {
      sum.r += data[pixelIndex * 4];
      sum.g += data[pixelIndex * 4 + 1];
      sum.b += data[pixelIndex * 4 + 2];
      return sum;
    },
    { r: 0, g: 0, b: 0 }
  );
  background.r /= cornerOffsets.length;
  background.g /= cornerOffsets.length;
  background.b /= cornerOffsets.length;

  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const matchesBackground = (pixelIndex) => {
    const offset = pixelIndex * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const dr = r - background.r;
    const dg = g - background.g;
    const db = b - background.b;
    const distanceSquared = dr * dr + dg * dg + db * db;
    const nearWhite = r > 188 && g > 188 && b > 188;
    return distanceSquared < 52 * 52 || nearWhite;
  };

  const enqueue = (pixelIndex) => {
    if (visited[pixelIndex] || !matchesBackground(pixelIndex)) return;
    visited[pixelIndex] = 1;
    queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    data[pixelIndex * 4 + 3] = 0;
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    if (x > 0) enqueue(pixelIndex - 1);
    if (x + 1 < width) enqueue(pixelIndex + 1);
    if (y > 0) enqueue(pixelIndex - width);
    if (y + 1 < height) enqueue(pixelIndex + width);
  }

  return data;
}

mkdirSync(targetDir, { recursive: true });
mkdirSync(tempDir, { recursive: true });

if (!existsSync(ffmpeg)) {
  throw new Error(`ffmpeg not found at ${ffmpeg}. Set FFMPEG_BIN to a working ffmpeg.exe.`);
}

for (const [action, id] of Object.entries(stickers)) {
  const source = path.join(sourceDir, `${id}.wxgf`);
  const raw = path.join(tempDir, `${action}.h265`);
  const target = path.join(targetDir, `${action}.webp`);
  if (!existsSync(source)) throw new Error(`Missing source sticker: ${source}`);
  await writeFile(raw, stripWxgfHeader(await readFile(source)));
  const frameDir = mkdtempSync(path.join(tempDir, `${action}-`));
  const inputPattern = path.join(frameDir, "input-%04d.png");

  const decodeFilter = [
    `setpts=${playbackPace[action] ?? 1}*PTS`,
    "fps=20",
    "scale=320:320:force_original_aspect_ratio=decrease:flags=lanczos",
    "pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
    "format=rgba"
  ].join(",");

  const decodeResult = spawnSync(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      raw,
      "-vf",
      decodeFilter,
      "-vsync",
      "0",
      inputPattern
    ],
    { encoding: "utf8", windowsHide: true }
  );

  if (decodeResult.status !== 0) {
    throw new Error(
      `ffmpeg decode failed for ${action}: ${decodeResult.stderr || decodeResult.stdout}`
    );
  }

  const frames = readdirSync(frameDir)
    .filter((name) => /^input-\d+\.png$/.test(name))
    .sort();
  if (frames.length === 0) throw new Error(`No frames decoded for ${action}`);

  for (let index = 0; index < frames.length; index += 1) {
    const inputPath = path.join(frameDir, frames[index]);
    const outputPath = path.join(
      frameDir,
      `processed-${String(index + 1).padStart(4, "0")}.png`
    );
    const image = await sharp(inputPath)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cleaned = removeConnectedBackground(
      image.data,
      image.info.width,
      image.info.height
    );
    await sharp(cleaned, {
      raw: {
        width: image.info.width,
        height: image.info.height,
        channels: 4
      }
    })
      .png()
      .toFile(outputPath);
  }

  const encodeResult = spawnSync(
    ffmpeg,
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-framerate",
      "20",
      "-i",
      path.join(frameDir, "processed-%04d.png"),
      "-c:v",
      "libwebp_anim",
      "-lossless",
      "1",
      "-loop",
      "0",
      "-compression_level",
      "5",
      target
    ],
    { encoding: "utf8", windowsHide: true }
  );

  if (encodeResult.status !== 0) {
    throw new Error(
      `ffmpeg encode failed for ${action}: ${encodeResult.stderr || encodeResult.stdout}`
    );
  }
  const info = await stat(target);
  if (info.size < 1000) throw new Error(`Converted sticker is unexpectedly small: ${target}`);
  console.log(`${action}: ${Math.round(info.size / 1024)} KB`);
}
