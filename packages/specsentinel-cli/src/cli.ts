#!/usr/bin/env node
import minimist from "minimist";
import { compareScreenSpec } from "./comparator";
import { FigmaClient } from "./figmaClient";
import { runFlutterTestAndReadSpec } from "./flutterTestRunner";
import { ScreenSpec } from "./types";
import { promises as fs } from "fs";

const die = (msg: string): never => {
  console.error(msg);
  process.exit(1);
};

const parseArgs = () => {
  const argv = minimist(process.argv.slice(2));
  const cmd = argv._[0];
  if (cmd !== "check") {
    die(`Unknown command. Usage: specsentinel check --screen <name> --figma-file <key> --figma-node <id> --flutter-test <path> --output <path>`);
  }

  const screen = argv.screen as string | undefined;
  const figmaFile = argv["figma-file"] as string | undefined;
  const figmaNode = argv["figma-node"] as string | undefined;
  const flutterTest = argv["flutter-test"] as string | undefined;
  const output = argv.output as string | undefined;
  const workingDirectory = argv.cwd as string | undefined;

  if (!screen || !figmaFile || !figmaNode || !flutterTest || !output) {
    die(`Missing required args. Required: --screen --figma-file --figma-node --flutter-test --output`);
  }

  return { screen, figmaFile, figmaNode, flutterTest, output, workingDirectory };
};

const loadActualSpec = async (opts: { flutterTest: string; output: string; cwd?: string }): Promise<ScreenSpec> => {
  return runFlutterTestAndReadSpec({
    testPath: opts.flutterTest,
    outputPath: opts.output,
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
  const { screen, figmaFile, figmaNode, flutterTest, output, workingDirectory } = parseArgs();

  console.log(`[SpecSentinel] Running flutter test: ${flutterTest}`);
  const actual = await loadActualSpec({ flutterTest, output, cwd: workingDirectory });

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
    // Save diffs alongside actual output for CI visibility.
    const diffPath = output.replace(/\\.json$/, ".diff.json");
    await fs.writeFile(diffPath, JSON.stringify(result.diffs, null, 2));
    die("Specs differ");
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
