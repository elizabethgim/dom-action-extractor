// scripts/shorten-observable-file-names.js
import fs  from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "src", "datasets");
const MAX_BASENAME = 24;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function replaceInFile(filePath, replacements) {
  const ext = path.extname(filePath);
  const textLike = [".js", ".ts", ".tsx", ".jsx", ".mjs", ".cjs", ".json", ".md", ".html", ".css"];
  if (!textLike.includes(ext)) return;

  let content = fs.readFileSync(filePath, "utf8");
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    console.log(`updated: ${path.relative(ROOT, filePath)}`);
  }
}

function makeShortName(filename, usedNames) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  let shortBase = base.length > MAX_BASENAME ? base.slice(0, MAX_BASENAME) : base;
  let candidate = `${shortBase}${ext}`;
  let i = 1;

  while (usedNames.has(candidate)) {
    candidate = `${shortBase}_${i}${ext}`;
    i++;
  }

  usedNames.add(candidate);
  return candidate;
}

function main() {
  const allFiles = walk(TARGET_DIR);
  const observableFiles = allFiles.filter((p) => p.includes(`${path.sep}files${path.sep}`));

  const replacements = [];
  const renameJobs = [];

  const usedByDir = new Map();

  for (const oldPath of observableFiles) {
    const dir = path.dirname(oldPath);
    const oldName = path.basename(oldPath);
    const ext = path.extname(oldName);
    const base = path.basename(oldName, ext);

    // 너무 긴 이름만 대상
    if (base.length <= MAX_BASENAME) continue;

    if (!usedByDir.has(dir)) usedByDir.set(dir, new Set(fs.readdirSync(dir)));
    const usedNames = usedByDir.get(dir);

    const newName = makeShortName(oldName, usedNames);
    const newPath = path.join(dir, newName);

    renameJobs.push([oldPath, newPath]);
    replacements.push([oldName, newName]);
  }

  // 실제 파일 rename
  for (const [oldPath, newPath] of renameJobs) {
    fs.renameSync(oldPath, newPath);
    console.log(`renamed: ${path.relative(ROOT, oldPath)} -> ${path.basename(newPath)}`);
  }

  // 프로젝트 전체 문자열 치환
  const projectFiles = walk(ROOT).filter((p) => !p.includes(`${path.sep}node_modules${path.sep}`) && !p.includes(`${path.sep}.git${path.sep}`));

  for (const filePath of projectFiles) {
    replaceInFile(filePath, replacements);
  }

  console.log("done");
}

main();