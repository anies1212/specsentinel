import { promises as fs } from "fs";
import path from "path";
import { GapSpec, PaddingSpec, ScreenSpec, TextSpec } from "./types";

const toSnake = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

const numberFrom = (input: string | undefined): number | null => {
  if (!input) return null;
  const n = Number(input.trim());
  return Number.isFinite(n) ? n : null;
};

export const findSourcePath = async (opts: { screen: string; cwd?: string; sourceRoot: string }): Promise<string> => {
  const root = path.resolve(opts.cwd ?? process.cwd(), opts.sourceRoot);
  const target = `${toSnake(opts.screen)}.dart`;
  const matches: string[] = [];

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name === target) {
        matches.push(full);
      }
    }
  };

  await walk(root);
  if (matches.length === 0) throw new Error(`No source file found for screen ${opts.screen} (looking for ${target} under ${root})`);
  if (matches.length > 1) throw new Error(`Multiple source files found for screen ${opts.screen}: ${matches.join(", ")}`);
  return matches[0];
};

export const extractStaticSpecFromSource = async (opts: {
  screen: string;
  sourcePath: string;
}): Promise<ScreenSpec> => {
  const content = await fs.readFile(opts.sourcePath, "utf-8");

  const texts: TextSpec[] = [];
  const textRegex = /Text\s*\(\s*(['"])(?<text>[^'"]*?)\1[\s,)]/gms;
  let textMatch: RegExpExecArray | null;
  while ((textMatch = textRegex.exec(content)) !== null) {
    const text = textMatch.groups?.text ?? null;
    // attempt to find a nearby fontSize in the same Text invocation
    const slice = content.slice(textMatch.index, textMatch.index + 400);
    const fontSizeMatch = /fontSize\s*:\s*(?<size>[0-9.]+)/.exec(slice);
    texts.push({ text, fontSize: numberFrom(fontSizeMatch?.groups?.size) });
  }

  const paddings: PaddingSpec[] = [];
  const paddingRegex =
    /EdgeInsets\.fromLTRB\s*\(\s*(?<l>[0-9.]+)\s*,\s*(?<t>[0-9.]+)\s*,\s*(?<r>[0-9.]+)\s*,\s*(?<b>[0-9.]+)\s*\)/gms;
  let padMatch: RegExpExecArray | null;
  while ((padMatch = paddingRegex.exec(content)) !== null) {
    paddings.push({
      left: numberFrom(padMatch.groups?.l) ?? 0,
      top: numberFrom(padMatch.groups?.t) ?? 0,
      right: numberFrom(padMatch.groups?.r) ?? 0,
      bottom: numberFrom(padMatch.groups?.b) ?? 0
    });
  }

  const gaps: GapSpec[] = [];
  const gapRegex = /SizedBox\s*\(\s*(?:height\s*:\s*(?<h>[0-9.]+))?\s*,?\s*(?:width\s*:\s*(?<w>[0-9.]+))?/gms;
  let gapMatch: RegExpExecArray | null;
  while ((gapMatch = gapRegex.exec(content)) !== null) {
    const h = numberFrom(gapMatch?.groups?.h);
    const w = numberFrom(gapMatch?.groups?.w);
    if (h !== null || w !== null) {
      gaps.push({ height: h, width: w });
    }
  }

  return {
    screenName: opts.screen,
    texts,
    paddings,
    gaps
  };
};
