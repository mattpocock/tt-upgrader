import path from "path";
import fs from "fs/promises";
import glob from "fast-glob";
import { homedir } from "os";
import fields from "../files/package.add.json" with { type: "json" };
import { execSync } from "child_process";

const NPM_PATH = path.resolve(import.meta.dirname, "../files/001-npm");
const PNPM_PATH = path.resolve(import.meta.dirname, "../files/002-pnpm");

const TOTAL_TYPESCRIPT_FOLDER = path.resolve(
  homedir(),
  "repos",
  "total-typescript"
);

const copyFiles = async (src: string, dest: string) => {
  const files = await glob(`${src}/**/**`, {
    onlyFiles: true,
    dot: true,
  });

  for await (const file of files) {
    const relativePath = path.relative(src, file);
    const destPath = path.resolve(dest, relativePath);

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(file, destPath);
  }
};

const dirs = await fs
  .readdir(TOTAL_TYPESCRIPT_FOLDER)
  .then((dirs) =>
    dirs.map((dir) => path.resolve(TOTAL_TYPESCRIPT_FOLDER, dir))
  );

const filesToDelete = await fs
  .readFile(
    path.resolve(import.meta.dirname, "../files/files-to-delete.txt"),
    "utf-8"
  )
  .then((res) => res.trim().split("\n"));

for (const dir of dirs) {
  // If the branch is not main, error
  const branch = execSync("git branch --show-current", {
    cwd: dir,
  }).toString();

  if (branch.trim() !== "main") {
    console.error(`Error: ${dir} is not on the main branch`);
    process.exit(1);
  }

  // If there are uncommitted changes, error
  const status = execSync("git status --porcelain", {
    cwd: dir,
  }).toString();

  if (status.trim() !== "") {
    console.error(`Error: ${dir} has uncommitted changes`);
    process.exit(1);
  }

  // Fetch all
  execSync("git fetch --all", {
    cwd: dir,
  });

  // Pull
  execSync("git pull", {
    cwd: dir,
  });

  let packageManager = "npm";

  // Detect pnpm
  try {
    await fs.readFile(path.resolve(dir, "pnpm-lock.yaml"));
    packageManager = "pnpm";
  } catch (e) {}

  // Delete files
  for (const file of filesToDelete) {
    await fs.rm(path.resolve(dir, file), { force: true, recursive: true });
  }

  // Copy npm files
  await copyFiles(NPM_PATH, dir);

  // Copy pnpm files
  if (packageManager === "pnpm") {
    await copyFiles(PNPM_PATH, dir);
  }

  // Add fields to package.json
  const packageJsonPath = path.resolve(dir, "package.json");

  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));

  Object.entries(fields).forEach(([key, value]) => {
    packageJson[key] = value;
  });

  // If pnpm, add packageManager field
  if (packageManager === "pnpm") {
    packageJson.packageManager = "pnpm@8.15.6";
  }

  await fs.writeFile(
    packageJsonPath,
    JSON.stringify(packageJson, null, 2) + "\n"
  );

  // If there are no changes, continue
  const statusAfterEdits = execSync("git status --porcelain", {
    cwd: dir,
  }).toString();

  if (statusAfterEdits.trim() === "") {
    console.log(`No changes: ${dir}`);
    continue;
  }

  // Commit
  execSync("git add .", {
    cwd: dir,
  });

  execSync("git commit -m 'chore: add files'", {
    cwd: dir,
  });

  // Push
  execSync("git push", {
    cwd: dir,
  });

  console.log(`Done: ${dir}`);
}
