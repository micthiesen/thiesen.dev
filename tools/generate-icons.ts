import { Effect } from "effect";
import sharp from "sharp";

// The outlined SVG is the source of truth; no installed fonts are needed.
const publicDirectory = new URL("../public/", import.meta.url);

const generate = Effect.gen(function* () {
  const svg = yield* Effect.tryPromise(() =>
    Bun.file(new URL("favicon.svg", publicDirectory)).text(),
  );
  // iOS supplies its own corner mask. Keep touch and launcher icons opaque.
  const square = svg.replace(' rx="12"', "");
  for (const [name, size] of [
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ] as const) {
    yield* Effect.tryPromise(() =>
      sharp(Buffer.from(square), { density: 768 })
        .resize(size, size)
        .png()
        .toFile(new URL(name, publicDirectory).pathname),
    );
  }

  const sizes = [16, 32, 48];
  const images: Buffer[] = [];
  for (const size of sizes) {
    images.push(
      yield* Effect.tryPromise(() =>
        sharp(Buffer.from(svg), { density: 768 }).resize(size, size).png().toBuffer(),
      ),
    );
  }
  // ICO directory entries point to individually rasterized PNG images.
  const directory = Buffer.alloc(6 + 16 * sizes.length);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  for (const [index, image] of images.entries()) {
    const entry = 6 + index * 16;
    directory[entry] = sizes[index]!;
    directory[entry + 1] = sizes[index]!;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(image.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += image.length;
  }
  yield* Effect.tryPromise(() =>
    Bun.write(
      new URL("favicon.ico", publicDirectory),
      Buffer.concat([directory, ...images]),
    ),
  );
});

await Effect.runPromise(generate);
