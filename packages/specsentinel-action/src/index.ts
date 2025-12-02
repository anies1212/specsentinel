import * as core from "@actions/core";
import { spawn } from "child_process";
import path from "path";

const FIGMA_SPEC_REGEX =
  /figma-spec:\s*(?<screen>[\w-]+)\s+https:\/\/www\.figma\.com\/file\/(?<fileKey>[\w]+)[^?\s]*\?node-id=(?<nodeId>[\w:-]+)/i;

const runSpecSentinel = async (
  cmdArgs: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}
): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["--yes", "specsentinel", "check", ...cmdArgs], {
      cwd: opts.cwd ?? process.cwd(),
      stdio: "inherit",
      env: { ...process.env, ...opts.env }
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`specsentinel exited with code ${code}`));
    });
  });

const parseFigmaSpecLine = (body: string) => {
  const match = body.match(FIGMA_SPEC_REGEX);
  if (!match || !match.groups) return null;
  return {
    screen: match.groups.screen,
    fileKey: match.groups.fileKey,
    nodeId: match.groups.nodeId
  };
};

const main = async () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    core.setFailed("GITHUB_EVENT_PATH is not set");
    return;
  }

  const event = require(eventPath);
  const commentBody: string | undefined = event.comment?.body;
  if (!commentBody) {
    core.info("No comment body found; skipping");
    return;
  }

  const parsed = parseFigmaSpecLine(commentBody);
  if (!parsed) {
    core.info("No figma-spec line detected; skipping");
    return;
  }

  const githubToken = core.getInput("github-token", { required: true });
  const figmaToken = core.getInput("figma-token", { required: true });
  const outputDir = core.getInput("output-dir") || "build/specsentinel";
  const workingDirectory = core.getInput("working-directory") || ".";

  const args = [
    "--screen",
    parsed.screen,
    "--figma-file",
    parsed.fileKey,
    "--figma-node",
    parsed.nodeId,
    "--output-dir",
    outputDir,
    "--cwd",
    workingDirectory
  ];

  core.startGroup("SpecSentinel");
  core.info(`Invoking SpecSentinel for ${parsed.screen}`);
  try {
    await runSpecSentinel(args, {
      cwd: path.resolve(workingDirectory),
      env: { FIGMA_TOKEN: figmaToken, GITHUB_TOKEN: githubToken }
    });
    core.info("SpecSentinel succeeded");
  } catch (err) {
    core.setFailed(`SpecSentinel failed: ${err}`);
  } finally {
    core.endGroup();
  }
};

main();
