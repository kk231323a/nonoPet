/*
 * Minimal local-only WeChat 4.x emoticon extractor.
 *
 * Encryption and key derivation details are adapted from the MIT-licensed
 * project Circumsized/Wechat-Emoticon-Export. This script only processes the
 * user's `business/emoticon` cache and never reads chat databases.
 */

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const defaultOutput = path.join(workspaceRoot, "work", "wechat-stickers");

const MAGIC_FORMATS = [
  { magic: Buffer.from([0x89, 0x50, 0x4e, 0x47]), extension: "png" },
  { magic: Buffer.from("GIF8"), extension: "gif" },
  { magic: Buffer.from([0xff, 0xd8, 0xff]), extension: "jpg" },
  { magic: Buffer.from("RIFF"), extension: "webp" },
  { magic: Buffer.from("wxgf"), extension: "wxgf" }
];

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { dataDir: null, outputDir: defaultOutput };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--data-dir") result.dataDir = args[index + 1];
    if (args[index] === "--out") result.outputDir = path.resolve(args[index + 1]);
  }
  return result;
}

function findDataDir(explicit) {
  if (explicit) return path.resolve(explicit);
  const roots = [
    path.join(os.homedir(), "xwechat_files"),
    path.join(os.homedir(), "Documents", "xwechat_files"),
    "D:\\WeChatfiles\\xwechat_files",
    "E:\\WeChatfiles\\xwechat_files"
  ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const account = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^wxid_.+_[0-9a-f]{4}$/i.test(entry.name))
      .map((entry) => path.join(root, entry.name))
      .sort((a, b) => a.localeCompare(b))[0];
    if (account) return account;
  }
  throw new Error("Unable to locate the WeChat 4.x account data directory.");
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function formatOf(buffer) {
  return MAGIC_FORMATS.find(({ magic }) => buffer.subarray(0, magic.length).equals(magic))?.extension ?? null;
}

function decryptFile(file, key) {
  const encrypted = readFileSync(file);
  if (encrypted.length < 16 || encrypted.length % 16 !== 0) return null;
  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, key);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } catch {
    return null;
  }
}

function deriveKey(seed, wxid) {
  return crypto
    .createHash("md5")
    .update(`${seed}${wxid}EMOTICON`, "utf8")
    .digest()
    .subarray(0, 16);
}

function verifyKey(key, probe) {
  try {
    const decipher = crypto.createDecipheriv("aes-128-cbc", key, key);
    const plain = Buffer.concat([decipher.update(probe), decipher.final()]);
    return MAGIC_FORMATS.some(({ magic }) => plain.subarray(0, magic.length).equals(magic));
  } catch {
    return false;
  }
}

function findKey(dataDir) {
  const emoticonDir = path.join(dataDir, "business", "emoticon");
  const candidates = ["Thumb", "Persist", "PersistStore", "ThumbStore"]
    .flatMap((subdir) => walkFiles(path.join(emoticonDir, subdir)))
    .filter((file) => {
      try {
        return readFileSync(file).length >= 16;
      } catch {
        return false;
      }
    });
  if (candidates.length === 0) throw new Error("No encrypted emoticon files were found.");

  let probe = null;
  for (const file of candidates) {
    probe = readFileSync(file).subarray(0, 16);
    if (probe.length === 16) break;
  }
  if (!probe) throw new Error("Unable to read an emoticon encryption probe.");

  const wxid = path.basename(dataDir).replace(/_[0-9a-f]{4}$/i, "");
  let rawSeeds;
  try {
    rawSeeds = execFileSync("python", [path.join(scriptDir, "scan_wechat_seeds.py")], {
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      timeout: 120_000
    });
  } catch (error) {
    throw new Error(`WeChat seed scan failed: ${error.message}`);
  }

  const seeds = JSON.parse(rawSeeds);
  for (const seed of seeds) {
    const key = deriveKey(seed, wxid);
    if (verifyKey(key, probe)) return { key, emoticonDir, candidateCount: seeds.length };
  }
  throw new Error(
    `No matching emoticon key was found among ${seeds.length} seed candidates. Keep WeChat signed in and running.`
  );
}

function exportDecrypted(emoticonDir, key, outputDir) {
  const exported = [];
  for (const subdir of ["Persist", "Thumb", "ThumbStore", "PersistStore"]) {
    const sourceRoot = path.join(emoticonDir, subdir);
    const targetRoot = path.join(outputDir, "decrypted", subdir);
    mkdirSync(targetRoot, { recursive: true });
    let ok = 0;
    let failed = 0;
    for (const file of walkFiles(sourceRoot)) {
      const name = path.basename(file).replace(/\.thumb$/i, "");
      if (!/^[0-9a-f]{32}$/i.test(name)) continue;
      const plain = decryptFile(file, key);
      const format = plain ? formatOf(plain) : null;
      if (!plain || !format) {
        failed += 1;
        continue;
      }
      const target = path.join(targetRoot, `${name}.${format}`);
      writeFileSync(target, plain);
      exported.push({ id: name, subdir, format, path: target, size: plain.length });
      ok += 1;
    }
    console.log(`${subdir}: ${ok} decrypted, ${failed} skipped`);
  }
  return exported;
}

async function makeContactSheet(files, outputDir, pageSize = 60) {
  const columns = 6;
  const tileWidth = 150;
  const imageHeight = 132;
  const labelHeight = 24;
  const tileHeight = imageHeight + labelHeight;
  const pages = [];

  for (let pageStart = 0; pageStart < files.length; pageStart += pageSize) {
    const pageFiles = files.slice(pageStart, pageStart + pageSize);
    const rows = Math.ceil(pageFiles.length / columns);
    const width = columns * tileWidth;
    const height = rows * tileHeight;
    const composites = [];

    for (let index = 0; index < pageFiles.length; index += 1) {
      const file = pageFiles[index];
      const field = Math.floor(index / columns);
      const column = index % columns;
      const left = column * tileWidth;
      const top = field * tileHeight;
      try {
        const tile = await sharp(file.path, { animated: false })
          .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .resize(tileWidth - 14, imageHeight - 12, {
            fit: "contain",
            background: { r: 255, g: 250, b: 244, alpha: 0 }
          })
          .png()
          .toBuffer();
        composites.push({ input: tile, left: left + 7, top: top + 6 });
      } catch {
        // Non-image formats such as wxgf are listed in the manifest.
      }
      const label = Buffer.from(
        `<svg width="${tileWidth - 14}" height="${labelHeight}">
          <rect width="100%" height="100%" rx="8" fill="#fff8ef"/>
          <text x="50%" y="16" text-anchor="middle" font-family="Consolas, monospace"
            font-size="11" fill="#60423b">${file.id.slice(0, 8)}</text>
        </svg>`
      );
      composites.push({ input: label, left: left + 7, top: top + imageHeight });
    }

    const outputPath = path.join(outputDir, `contact-sheet-${pages.length + 1}.jpg`);
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: { r: 246, g: 239, b: 232 }
      }
    })
      .composite(composites)
      .jpeg({ quality: 88 })
      .toFile(outputPath);
    pages.push(outputPath);
  }
  return pages;
}

async function main() {
  const args = parseArgs();
  const dataDir = findDataDir(args.dataDir);
  const outputDir = args.outputDir;
  mkdirSync(outputDir, { recursive: true });

  console.log(`Data directory: ${dataDir}`);
  const { key, emoticonDir, candidateCount } = findKey(dataDir);
  console.log(`Verified a local emoticon key from ${candidateCount} seed candidates.`);

  const exported = exportDecrypted(emoticonDir, key, outputDir);
  writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        source: "Whisper local WeChat emoticon cache",
        counts: exported.reduce((counts, item) => {
          counts[item.subdir] = (counts[item.subdir] ?? 0) + 1;
          return counts;
        }, {}),
        files: exported
      },
      null,
      2
    )
  );

  const thumbFiles = exported
    .filter((item) => item.subdir === "Thumb" && ["png", "jpg", "gif", "webp"].includes(item.format))
    .sort((a, b) => a.id.localeCompare(b.id));
  const pages = await makeContactSheet(thumbFiles, outputDir);
  console.log(`Contact sheets: ${pages.length}`);
  for (const page of pages) console.log(page);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
