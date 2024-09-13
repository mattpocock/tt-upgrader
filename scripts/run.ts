import path from "path";
import fs from "fs/promises";
import glob from "fast-glob";
import { homedir } from "os";

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
    console.log(file);

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
  let packageManager = "npm";

  for (const file of filesToDelete) {
    await fs.rm(path.resolve(dir, file), { force: true, recursive: true });
  }

  try {
    await fs.readFile(path.resolve(dir, "pnpm-lock.yaml"));
    packageManager = "pnpm";
  } catch (e) {}

  await copyFiles(NPM_PATH, dir);

  if (packageManager === "pnpm") {
    await copyFiles(PNPM_PATH, dir);
  }
}
