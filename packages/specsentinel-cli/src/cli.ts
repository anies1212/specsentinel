#!/usr/bin/env node
import minimist from "minimist";
import { promises as fs } from "fs";
import path from "path";
import { compareScreenSpec } from "./comparator";
import { FigmaClient } from "./figmaClient";
import { runFlutterTestAndReadSpec } from "./flutterTestRunner";
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
      `Unknown command. Usage: specsentinel check --screen <name> --figma-file <key> --figma-node <id> [--flutter-test-path <path>] [--output-dir <dir>] [--test-root <dir>]`
    );
  }

  const screen = argv.screen as string | undefined;
  const figmaFile = argv["figma-file"] as string | undefined;
  const figmaNode = argv["figma-node"] as string | undefined;
  const flutterTestPath = argv["flutter-test-path"] as string | undefined;
  const outputDir = (argv["output-dir"] as string | undefined) ?? "build/specsentinel";
  const testRoot = (argv["test-root"] as string | undefined) ?? "test";
  const workingDirectory = argv.cwd as string | undefined;

  if (!screen || !figmaFile || !figmaNode) {
    die(`Missing required args. Required: --screen --figma-file --figma-node`);
  }

  return { screen, figmaFile, figmaNode, flutterTestPath, outputDir, testRoot, workingDirectory };
};

const loadActualSpec = async (opts: {
  flutterTestPath: string;
  outputDir: string;
  screen: string;
  cwd?: string;
}): Promise<ScreenSpec> => {
  return runFlutterTestAndReadSpec({
    testPath: opts.flutterTestPath,
    outputDir: opts.outputDir,
    screenName: opts.screen,
    cwd: opts.cwd
  });
};

const loadExpectedSpec = async (opts: { screen: string; figmaFile: string; figmaNode: string }): Promise<ScreenSpec> => {
  const token = process.env.FIGMA_TOKEN;
  if (!token) {
    die(`FIGMA_TOKEN env var is required`);
  }

  const client = new FigmaClient({ token });
  return client.fetchScreenSpec(opts.figmaFile, opts.figmaNode, opts.screen);
};

const toSnake = (name: string): string =>
  name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

const findTestPath = async (opts: {
  screen: string;
  cwd?: string;
  testRoot: string;
}): Promise<string> => {
  if (!opts.screen) throw new Error("screen is required to find test path");
  const root = path.resolve(opts.cwd ?? process.cwd(), opts.testRoot);
  const targetFile = `${toSnake(opts.screen)}_test.dart`;
  const matches: string[] = [];

  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && entry.name === targetFile) {
        matches.push(full);
      }
    }
  };

  await walk(root);

  if (matches.length === 0) {
    throw new Error(`No test file found for screen ${opts.screen} (looking for ${targetFile} under ${root})`);
  }
  if (matches.length > 1) {
    throw new Error(`Multiple test files found for screen ${opts.screen}: ${matches.join(", ")}`);
  }
  return matches[0];
};

const main = async () => {
  const { screen, figmaFile, figmaNode, flutterTestPath, outputDir, testRoot, workingDirectory } = parseArgs();
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.join(workingDirectory ?? process.cwd(), outputDir);
  const testPath =
    flutterTestPath ??
    (await findTestPath({
      screen,
      cwd: workingDirectory,
      testRoot
    }));

  console.log(`[SpecSentinel] Running flutter test: ${testPath}`);
  const actual = await loadActualSpec({
    flutterTestPath: testPath,
    outputDir: resolvedOutputDir,
    screen,
    cwd: workingDirectory
  });

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
