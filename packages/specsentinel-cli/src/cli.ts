#!/usr/bin/env node
import minimist from "minimist";
import { compareScreenSpec } from "./comparator";
import { FigmaClient } from "./figmaClient";
import { runFlutterTestAndReadSpec } from "./flutterTestRunner";
import { ScreenSpec } from "./types";
import { promises as fs } from "fs";
import path from "path";

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const parseArgs = () => {
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];
  if (cmd !== "check") {
    die(
      `Unknown command. Usage: specsentinel check --screen <name> --figma-file <key> --figma-node <id> --flutter-test-path <path> --output-dir <dir>`
    );
  }

  const screen = argv.screen as string | undefined;
  const figmaFile = argv["figma-file"] as string | undefined;
  const figmaNode = argv["figma-node"] as string | undefined;
  const flutterTestPath = argv["flutter-test-path"] as string | undefined;
  const outputDir = (argv["output-dir"] as string | undefined) ?? "build/specsentinel";
  const workingDirectory = argv.cwd as string | undefined;

  if (!screen || !figmaFile || !figmaNode || !flutterTestPath) {
    die(`Missing required args. Required: --screen --figma-file --figma-node --flutter-test-path`);
  }

  return { screen, figmaFile, figmaNode, flutterTestPath, outputDir, workingDirectory };
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

const main = async () => {
  const { screen, figmaFile, figmaNode, flutterTestPath, outputDir, workingDirectory } = parseArgs();
  const resolvedOutputDir = path.isAbsolute(outputDir)
    ? outputDir
    : path.join(workingDirectory ?? process.cwd(), outputDir);

  console.log(`[SpecSentinel] Running flutter test: ${flutterTestPath}`);
  const actual = await loadActualSpec({
    flutterTestPath,
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
