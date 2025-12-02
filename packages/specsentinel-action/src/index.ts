import * as core from "@actions/core";
import * as github from "@actions/github";
import { spawn } from "child_process";
import path from "path";

const FIGMA_SPEC_REGEX = /figma-spec:\\s*(?<screen>[\\w-]+)\\s+https:\\/\\/www\\.figma\\.com\\/file\\/(?<fileKey>[\\w]+)[^?\\s]*\\?node-id=(?<nodeId>[\\w:-]+)/i;

const runSpecSentinel = async (cmdArgs: string[], cwd?: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn("npx", ["--yes", "specsentinel", "check", ...cmdArgs], {
      cwd: cwd ?? process.cwd(),
      stdio: "inherit"
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

  const flutterTest = core.getInput("flutter-test") || "test/spec/login_page_spec.dart";
  const output = core.getInput("output") || "build/specsentinel/output.json";
  const workingDirectory = core.getInput("working-directory") || ".";

  const args = [
    "--screen",
    parsed.screen,
    "--figma-file",
    parsed.fileKey,
    "--figma-node",
    parsed.nodeId,
    "--flutter-test",
    flutterTest,
    "--output",
    output,
    "--cwd",
    workingDirectory
  ];

  core.startGroup("SpecSentinel");
  core.info(`Invoking SpecSentinel for ${parsed.screen}`);
  try {
    await runSpecSentinel(args, path.resolve(workingDirectory));
    core.info("SpecSentinel succeeded");
  } catch (err) {
    core.setFailed(`SpecSentinel failed: ${err}`);
  } finally {
    core.endGroup();
  }
};

main();
