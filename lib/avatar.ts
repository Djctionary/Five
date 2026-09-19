// Avatars are generated from the seed, so they need no storage and no
// external service. Same seed and style always produce the same image.

export const AVATAR_STYLES = ["grid", "blocks", "rings", "aura"] as const;

export type AvatarStyle = (typeof AVATAR_STYLES)[number];

export const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  grid: "格纹",
  blocks: "方块",
  rings: "圆环",
  aura: "光晕",
};

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return typeof value === "string" && (AVATAR_STYLES as readonly string[]).includes(value);
}

function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Palette = { bg: string; fg: string; alt: string };

function palette(random: () => number): Palette {
  const hue = Math.floor(random() * 360);
  const shift = 40 + Math.floor(random() * 80);
  return {
    bg: `hsl(${hue} 55% 93%)`,
    fg: `hsl(${hue} 62% 48%)`,
    alt: `hsl(${(hue + shift) % 360} 62% 58%)`,
  };
}

function gridSvg(random: () => number, p: Palette): string {
  // Five columns, mirrored around the middle one.
  const cells: string[] = [];
  const unit = 100 / 5;
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 5; row++) {
      if (random() < 0.45) continue;
      const fill = random() < 0.25 ? p.alt : p.fg;
      for (const c of col === 2 ? [2] : [col, 4 - col]) {
        cells.push(
          `<rect x="${c * unit}" y="${row * unit}" width="${unit}" height="${unit}" fill="${fill}"/>`,
        );
      }
    }
  }
  return cells.join("");
}

function blocksSvg(random: () => number, p: Palette): string {
  const cells: string[] = [];
  const unit = 100 / 4;
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      const r = random();
      if (r < 0.35) continue;
      cells.push(
        `<rect x="${col * unit + 2}" y="${row * unit + 2}" width="${unit - 4}" height="${
          unit - 4
        }" rx="${r < 0.6 ? unit / 2 : 5}" fill="${r < 0.75 ? p.fg : p.alt}"/>`,
      );
    }
  }
  return cells.join("");
}

function ringsSvg(random: () => number, p: Palette): string {
  const parts: string[] = [];
  let radius = 46;
  let index = 0;
  while (radius > 6) {
    parts.push(
      `<circle cx="50" cy="50" r="${radius}" fill="${index % 2 === 0 ? p.fg : p.alt}"/>`,
    );
    radius -= 6 + random() * 12;
    index++;
  }
  return parts.join("");
}

function auraSvg(random: () => number, p: Palette): string {
  const parts: string[] = [];
  for (let i = 0; i < 3; i++) {
    const cx = 25 + random() * 50;
    const cy = 25 + random() * 50;
    const r = 22 + random() * 26;
    parts.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${
        i === 1 ? p.alt : p.fg
      }" opacity="0.72"/>`,
    );
  }
  return parts.join("");
}

export function avatarSvg(style: string, seed: string): string {
  const safeStyle: AvatarStyle = isAvatarStyle(style) ? style : AVATAR_STYLES[0];
  const random = makeRandom(hash32(`${safeStyle}:${seed}`));
  const p = palette(random);

  const body =
    safeStyle === "grid"
      ? gridSvg(random, p)
      : safeStyle === "blocks"
        ? blocksSvg(random, p)
        : safeStyle === "rings"
          ? ringsSvg(random, p)
          : auraSvg(random, p);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`,
    `<rect width="100" height="100" fill="${p.bg}"/>`,
    body,
    `</svg>`,
  ].join("");
}

export function avatarUrl(style: string, seed: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(avatarSvg(style, seed))}`;
}

export function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}
