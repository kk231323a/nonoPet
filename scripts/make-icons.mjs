import sharp from "sharp";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildDir = path.join(root, "build");
const pngSourcePath = path.join(buildDir, "icon-source.png");
const svgSourcePath = path.join(buildDir, "icon.svg");

await mkdir(buildDir, { recursive: true });

function removeConnectedWhiteBackground(data, width, height) {
  const total = width * height;
  const visited = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const isWhite = (pixelIndex) => {
    const offset = pixelIndex * 4;
    return (
      data[offset] > 232 &&
      data[offset + 1] > 232 &&
      data[offset + 2] > 232
    );
  };

  const enqueue = (pixelIndex) => {
    if (visited[pixelIndex] || !isWhite(pixelIndex)) return;
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
}

async function createIconBuffer(source, size, contentRatio) {
  const inner = Math.round(size * contentRatio);
  const content = await sharp(source)
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: content, gravity: "center" }])
    .png()
    .toBuffer();
}

let source = await readFile(
  existsSync(pngSourcePath) ? pngSourcePath : svgSourcePath
);

if (existsSync(pngSourcePath)) {
  const image = await sharp(source).ensureAlpha().raw().toBuffer({
    resolveWithObject: true
  });
  removeConnectedWhiteBackground(image.data, image.info.width, image.info.height);
  source = await sharp(image.data, {
    raw: {
      width: image.info.width,
      height: image.info.height,
      channels: 4
    }
  })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

await writeFile(
  path.join(buildDir, "tray.png"),
  await createIconBuffer(source, 42, 0.92)
);
await writeFile(
  path.join(buildDir, "icon.png"),
  await createIconBuffer(source, 256, 0.9)
);

console.log("Generated build/tray.png and build/icon.png");
