import {
  showToast,
  Toast,
  getSelectedFinderItems,
  showHUD,
  closeMainWindow,
  Cache,
  environment,
} from "@raycast/api";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
import path from "path";
import { existsSync, statSync } from "fs";

const execFileAsync = promisify(execFile);
const cache = new Cache();
const PYTHON_PATH_CACHE_KEY = "python_path_v3"; // Changed to invalidate old cache
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const SUPPORTED_FORMATS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".bmp",
  ".heic",
  ".heif",
];
const MAX_FILE_SIZE = 100 * 1024 * 1024;

// Results are short JSON lines, but a model download also writes its progress
const MAX_OUTPUT_BUFFER = 10 * 1024 * 1024;

// `--version` would accept interpreters (e.g. Homebrew's) where rembg isn't
// installed. Importing rembg would cost as much as the script's own import, so
// only look its dependencies up; the script reports an install that is broken.
const CHECK_DEPENDENCIES = `
import importlib.util, sys
missing = [m for m in ("rembg", "onnxruntime", "PIL") if not importlib.util.find_spec(m)]
sys.exit(1 if missing else 0)
`;

async function pythonHasRembg(pythonPath: string): Promise<boolean> {
  try {
    await execFileAsync(pythonPath, ["-c", CHECK_DEPENDENCIES]);
    return true;
  } catch {
    return false;
  }
}

// Find Python path with caching
async function findPythonPath(): Promise<string | null> {
  // Check cache first
  const cachedData = cache.get(PYTHON_PATH_CACHE_KEY);
  if (cachedData) {
    try {
      const { pythonPath, timestamp } = JSON.parse(cachedData);
      if (Date.now() - timestamp < CACHE_DURATION) {
        // Verify it still works AND still has rembg
        if (await pythonHasRembg(pythonPath)) {
          return pythonPath;
        }
        // Cache is stale, continue to search
      }
    } catch {
      // Invalid cache, continue
    }
  }

  // Search for Python - prioritize the project's venv with absolute path.
  // The bundle runs from the launcher's install folder, and an app started from
  // the Dock doesn't get the terminal's PATH, so a bare python3 isn't enough.
  const home = os.homedir();
  const pythonPaths = [
    path.join(home, "code/tinycast/removebg/.venv/bin/python3"),
    path.join(home, "code/raycast/removebg/.venv/bin/python3"),
    path.join(home, ".pyenv/shims/python3"),
    "/usr/local/bin/python3",
    "/opt/homebrew/bin/python3",
    "/usr/bin/python3",
    "python3",
  ];

  for (const pythonPath of pythonPaths) {
    try {
      // Check if file exists first (for absolute paths)
      if (pythonPath.startsWith("/") && !existsSync(pythonPath)) {
        if (environment.isDevelopment) {
          console.log(`Python path does not exist: ${pythonPath}`);
        }
        continue;
      }
      // Only accept an interpreter that has rembg
      if (!(await pythonHasRembg(pythonPath))) {
        if (environment.isDevelopment) {
          console.log(`Python lacks rembg: ${pythonPath}`);
        }
        continue;
      }
      if (environment.isDevelopment) {
        console.log(`Found working Python: ${pythonPath}`);
      }
      // Cache the found path
      cache.set(
        PYTHON_PATH_CACHE_KEY,
        JSON.stringify({
          pythonPath,
          timestamp: Date.now(),
        }),
      );
      return pythonPath;
    } catch (e) {
      if (environment.isDevelopment) {
        console.log(`Python path failed: ${pythonPath}`, e);
      }
    }
  }

  return null;
}

type Feedback = { title: string; message: string };
type ImageResult = { input: string; output?: string; error?: string };

function rejectionFor(imagePath: string): Feedback | null {
  if (!existsSync(imagePath)) {
    return {
      title: "File Not Found",
      message: "The selected file could not be found",
    };
  }
  if (!SUPPORTED_FORMATS.includes(path.extname(imagePath).toLowerCase())) {
    return {
      title: "Invalid File Type",
      message: `Please select an image file (${SUPPORTED_FORMATS.join(", ")})`,
    };
  }
  let size: number;
  try {
    ({ size } = statSync(imagePath));
  } catch {
    // Gone since the check above: it must not cost the rest of the selection
    return {
      title: "File Not Found",
      message: "The selected file could not be found",
    };
  }
  if (size > MAX_FILE_SIZE) {
    return {
      title: "File Too Large",
      message: `File size (${(size / 1024 / 1024).toFixed(1)}MB) exceeds limit (100MB)`,
    };
  }
  return null;
}

// Rembg and its dependencies may write to stdout too, so skip what isn't a result
function parseResults(stdout: string): ImageResult[] {
  const results: ImageResult[] = [];
  for (const line of stdout.split("\n")) {
    try {
      const parsed = JSON.parse(line);
      if (parsed?.input) results.push(parsed);
    } catch {
      // Not a result line
    }
  }
  return results;
}

function describeError(errorMessage: string): Feedback {
  if (errorMessage.includes("No module named 'rembg'")) {
    return {
      title: "REMBG Not Installed",
      message: "Run: uv pip install -r requirements.txt",
    };
  }
  if (errorMessage.includes("No module named 'onnxruntime'")) {
    return {
      title: "ONNXRuntime Not Installed",
      message: "Run: uv pip install -r requirements.txt",
    };
  }
  if (errorMessage.includes("Permission denied")) {
    return { title: "Permission Error", message: "Check file permissions" };
  }
  if (errorMessage.includes("Memory") || errorMessage.includes("memory")) {
    return { title: "Out of Memory", message: "Image too large to process" };
  }
  // The last line says what went wrong: there is no log to read outside dev mode
  const lastLine = errorMessage.trim().split("\n").pop() ?? "";
  return {
    title: "Processing Failed",
    message: lastLine.substring(0, 100) || "Failed to remove background",
  };
}

// Which file failed only needs saying when several were selected
function withFileName(
  message: string,
  input: string | undefined,
  total: number,
): string {
  return input && total > 1 ? `${path.basename(input)}: ${message}` : message;
}

export default async function Command() {
  await closeMainWindow();

  try {
    const selectedItems = await getSelectedFinderItems();

    if (selectedItems.length === 0) {
      await showToast({
        style: Toast.Style.Failure,
        title: "No Image Selected",
        message: "Please select an image in Finder first",
      });
      return;
    }

    // Already plain POSIX paths: decoding them would break names containing "%"
    const images: string[] = [];
    const rejections: (Feedback & { input: string })[] = [];
    for (const { path: imagePath } of selectedItems) {
      const rejection = rejectionFor(imagePath);
      if (rejection) {
        rejections.push({ ...rejection, input: imagePath });
      } else {
        images.push(imagePath);
      }
    }

    if (images.length === 0) {
      const { input, title, message } = rejections[0];
      await showToast({
        style: Toast.Style.Failure,
        title,
        message: withFileName(message, input, selectedItems.length),
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: images.length === 1 ? "Processing Image" : "Processing Images",
      message:
        images.length === 1
          ? "Removing background..."
          : `Removing background from ${images.length} images...`,
    });

    // Assets are the only extra files Raycast and Tinycast both install
    const scriptPath = path.join(environment.assetsPath, "remove_bg.py");

    // Find Python with caching
    const pythonPath = await findPythonPath();
    if (!pythonPath) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Python with rembg Not Found",
        message: "Run: uv pip install -r requirements.txt",
      });
      return;
    }

    // One process for the whole selection: loading the model is the slow part
    const args = [scriptPath, ...images];
    let stdout = "";
    let fatalError: string | null = null;
    const startTime = Date.now();

    try {
      ({ stdout } = await execFileAsync(pythonPath, args, {
        maxBuffer: MAX_OUTPUT_BUFFER,
      }));
    } catch (error: any) {
      // Images finished before the failure are saved, so still count them
      stdout = error.stdout ?? "";
      // Not error.message: it repeats the command, and so the selected file names
      fatalError = error.stderr?.trim() || "Python stopped before finishing";
      if (environment.isDevelopment) {
        console.error("Full error:", error);
        console.error("Command was:", pythonPath, args);
      }
    }

    if (environment.isDevelopment) {
      console.log(`Execution time: ${Date.now() - startTime}ms`);
      console.log("Output:", stdout);
    }

    const results = parseResults(stdout);
    const saved = results.filter((result) => result.output);
    const failed = results.find((result) => result.error);
    const firstError = fatalError ?? failed?.error;
    const total = selectedItems.length;

    if (saved.length === total) {
      await showHUD(
        total === 1
          ? `✅ Background removed! Saved as ${path.basename(saved[0].output as string)}`
          : `✅ Background removed from ${total} images`,
      );
      return;
    }

    const feedback = firstError
      ? describeError(firstError)
      : (rejections[0] ?? describeError("Output file was not created"));
    await showToast({
      style: Toast.Style.Failure,
      title:
        saved.length > 0
          ? `${saved.length} of ${total} Images Processed`
          : feedback.title,
      message: withFileName(
        feedback.message,
        fatalError ? undefined : (failed?.input ?? rejections[0]?.input),
        total,
      ),
    });
  } catch (error) {
    // Only log in development
    if (environment.isDevelopment) {
      console.error("Error:", error);
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message:
        error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
}
