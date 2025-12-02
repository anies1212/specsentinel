import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { ScreenSpec } from "./types";

export interface FlutterTestRunnerOptions {
  testPath: string;
  screenName: string;
  outputDir: string;
  cwd?: string;
}

export const runFlutterTestAndReadSpec = async (opts: FlutterTestRunnerOptions): Promise<ScreenSpec> => {
  const { testPath, outputDir, screenName, cwd } = opts;
  const baseDir = path.isAbsolute(outputDir) ? outputDir : path.join(cwd ?? process.cwd(), outputDir);
  const outputPath = path.join(baseDir, `${screenName}.json`);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn("flutter", ["test", testPath], {
      cwd: cwd ?? process.cwd(),
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`flutter test exited with code ${code}`));
      }
    });
  });

  const content = await fs.readFile(outputPath, "utf-8");
  return JSON.parse(content) as ScreenSpec;
};
