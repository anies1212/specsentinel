#!/usr/bin/env node
import minimist from "minimist";
import { promises as fs } from "fs";
import path from "path";
import { compareScreenSpec } from "./comparator";
import { FigmaClient } from "./figmaClient";
import { extractStaticSpecFromSource, findSourcePath } from "./staticExtractor";
import { ScreenSpec } from "./types";

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const parseArgs = () => {
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];
  if (cmd !== "check") {
    die(
      `Unknown command. Usage: specsentinel check --screen <name> --figma-file <key> --figma-node <id> --mode static [--output-dir <dir>] [--source <path>] [--source-root <dir>]`
    );
  }

  const screen = argv.screen as string | undefined;
  const figmaFile = argv["figma-file"] as string | undefined;
  const figmaNode = argv["figma-node"] as string | undefined;
  const outputDir = (argv["output-dir"] as string | undefined) ?? "build/specsentinel";
  const sourceRoot = (argv["source-root"] as string | undefined) ?? "lib";
  const sourcePath = argv["source"] as string | undefined;
  const workingDirectory = argv.cwd as string | undefined;
  const mode = ((argv.mode as string | undefined) ?? "static").toLowerCase();

  if (!screen || !figmaFile || !figmaNode) {
    die(`Missing required args. Required: --screen --figma-file --figma-node`);
  }

  if (mode !== "static") {
    die(`Only static mode is supported. Received mode="${mode}".`);
  }

  return {
    screen,
    figmaFile,
    figmaNode,
    outputDir,
    sourceRoot,
    sourcePath,
    mode,
    workingDirectory
  };
};

const loadExpectedSpec = async (opts: { screen: string; figmaFile: string; figmaNode: string }): Promise<ScreenSpec> => {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    die(`FIGMA_TOKEN env var is required`);
  }

  const client = new FigmaClient({ token });
  return client.fetchScreenSpec(opts.figmaFile, opts.figmaNode, opts.screen);
};

const main = async () => {
  const {
    screen,
    figmaFile,
    figmaNode,
    outputDir,
    sourceRoot,
    sourcePath,
    mode,
    workingDirectory
  } = parseArgs();
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.join(workingDirectory ?? process.cwd(), outputDir);
  let actual: ScreenSpec;

  const resolvedSourcePath =
    sourcePath ??
    (await findSourcePath({
      screen,
      cwd: workingDirectory,
      sourceRoot
    }));
  console.log(`[SpecSentinel] Extracting static spec from ${resolvedSourcePath}`);
  actual = await extractStaticSpecFromSource({ screen, sourcePath: resolvedSourcePath });
  const outputPath = path.join(resolvedOutputDir, `${screen}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(actual, null, 2));

  console.log(`[SpecSentinel] Fetching Figma spec: file=${figmaFile} node=${figmaNode}`);
  const expected = await loadExpectedSpec({ screen, figmaFile, figmaNode });

  console.log(`[SpecSentinel] Comparing specs...`);
  const result = compareScreenSpec(expected, actual);

  if (result.matches) {
    console.log("[SpecSentinel] ✅ Specs match");
    process.exit(0);
  } else {
    console.error("[SpecSentinel] ❌ Differences found:");
    result.diffs.forEach((d) => console.error(`- ${d.message}`));
    const diffPath = `${resolvedOutputDir}/${screen}.diff.json`;
    await fs.writeFile(diffPath, JSON.stringify(result.diffs, null, 2));
    die("Specs differ");
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
