import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(__dirname, "..");
const buildDir = path.join(repoRoot, "build");

type Diff = {
	type: "changed" | "extra" | "missing";
	path: string;
};

async function pathExists(filename: string) {
	try {
		await fs.promises.access(filename);
		return true;
	} catch {
		return false;
	}
}

async function collectFiles(dir: string, root = dir): Promise<Map<string, string>> {
	const files = new Map<string, string>();

	for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
		if (entry.name === ".git") {
			continue;
		}

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			for (const [relativePath, nestedPath] of await collectFiles(fullPath, root)) {
				files.set(relativePath, nestedPath);
			}
		} else if (entry.isFile()) {
			files.set(path.relative(root, fullPath), fullPath);
		}
	}

	return files;
}

async function filesMatch(a: string, b: string) {
	const [aContent, bContent] = await Promise.all([
		fs.promises.readFile(a),
		fs.promises.readFile(b),
	]);
	return aContent.equals(bContent);
}

async function compareDirs(expectedDir: string, actualDir: string) {
	const [expectedFiles, actualFiles] = await Promise.all([
		collectFiles(expectedDir),
		collectFiles(actualDir),
	]);
	const diffs: Diff[] = [];

	for (const [relativePath, expectedPath] of expectedFiles) {
		const actualPath = actualFiles.get(relativePath);
		if (!actualPath) {
			diffs.push({ type: "missing", path: relativePath });
		} else if (!(await filesMatch(expectedPath, actualPath))) {
			diffs.push({ type: "changed", path: relativePath });
		}
	}

	for (const relativePath of actualFiles.keys()) {
		if (!expectedFiles.has(relativePath)) {
			diffs.push({ type: "extra", path: relativePath });
		}
	}

	return diffs.sort((a, b) => a.path.localeCompare(b.path) || a.type.localeCompare(b.type));
}

async function main() {
	if (!(await pathExists(buildDir))) {
		throw new Error("Missing build/ directory; expected nested deployment repo");
	}

	const tmpRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "notes-fresh-build-"));
	const freshBuildDir = path.join(tmpRoot, "build");
	const freshDbFile = path.join(tmpRoot, "db.sqlite3");

	try {
		await execFileAsync("npm", ["run", "build"], {
			cwd: repoRoot,
			env: {
				...process.env,
				BUILD: freshBuildDir,
				SQLITE_DB_FILE: freshDbFile,
			},
			maxBuffer: 1024 * 1024 * 20,
		});

		const diffs = await compareDirs(freshBuildDir, buildDir);
		if (diffs.length === 0) {
			console.log("Fresh build matches build/.");
			return;
		}

		console.log(`Fresh build differs from build/ (${diffs.length} files):`);
		for (const diff of diffs) {
			console.log(`${diff.type.padEnd(7)} ${diff.path}`);
		}
		process.exitCode = 1;
	} finally {
		await fs.promises.rm(tmpRoot, { force: true, recursive: true });
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
