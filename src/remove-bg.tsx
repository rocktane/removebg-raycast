import { showToast, Toast, getSelectedFinderItems, showHUD, closeMainWindow, Cache, environment } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { existsSync, statSync } from "fs";

const execAsync = promisify(exec);
const cache = new Cache();
const PYTHON_PATH_CACHE_KEY = "python_path";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Get optimal buffer size based on file size
function getOptimalBufferSize(imagePath: string): number {
  try {
    const stats = statSync(imagePath);
    const fileSizeBytes = stats.size;
    // Scale buffer: 2x file size, min 1MB, max 50MB
    return Math.min(Math.max(fileSizeBytes * 2, 1024 * 1024), 50 * 1024 * 1024);
  } catch {
    return 10 * 1024 * 1024; // Default 10MB
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
        // Verify it still works
        try {
          await execAsync(`${pythonPath} --version`);
          return pythonPath;
        } catch {
          // Cache is stale, continue to search
        }
      }
    } catch {
      // Invalid cache, continue
    }
  }

  // Search for Python
  const pythonPaths = [
    "/Users/yohan/.pyenv/shims/python3",
    "/usr/local/bin/python3",
    "/usr/bin/python3",
    "/opt/homebrew/bin/python3",
    "python3"
  ];

  for (const pythonPath of pythonPaths) {
    try {
      await execAsync(`${pythonPath} --version`);
      // Cache the found path
      cache.set(PYTHON_PATH_CACHE_KEY, JSON.stringify({
        pythonPath,
        timestamp: Date.now()
      }));
      return pythonPath;
    } catch {
      // Try next path
    }
  }

  return null;
}

// Clean up old temporary files
async function cleanupOldTempFiles(tempDir: string): Promise<void> {
  try {
    if (!existsSync(tempDir)) return;

    const files = await fs.readdir(tempDir);
    const oneHourAgo = Date.now() - 3600000;

    for (const file of files) {
      const filePath = path.join(tempDir, file);
      try {
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < oneHourAgo) {
          await fs.unlink(filePath);
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch {
    // Ignore cleanup errors
  }
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

    const imagePath = decodeURIComponent(selectedItems[0].path.replace("file://", ""));

    // Validate file in one check
    const supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
    const fileExt = path.extname(imagePath).toLowerCase();

    if (!supportedFormats.includes(fileExt) || !existsSync(imagePath)) {
      await showToast({
        style: Toast.Style.Failure,
        title: !existsSync(imagePath) ? "File Not Found" : "Invalid File Type",
        message: !existsSync(imagePath)
          ? "The selected file could not be found"
          : `Please select an image file (${supportedFormats.join(", ")})`,
      });
      return;
    }

    // Check file size (max 100MB)
    const stats = statSync(imagePath);
    const maxSize = 100 * 1024 * 1024;
    if (stats.size > maxSize) {
      await showToast({
        style: Toast.Style.Failure,
        title: "File Too Large",
        message: `File size (${(stats.size / 1024 / 1024).toFixed(1)}MB) exceeds limit (100MB)`,
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: "Processing Image",
      message: "Removing background...",
    });

    // Get output path
    const dir = path.dirname(imagePath);
    const basename = path.basename(imagePath, fileExt);
    const outputExt = [".png", ".webp"].includes(fileExt) ? fileExt : ".png";
    const outputPath = path.join(dir, `${basename}-bg${outputExt}`);

    // Use existing Python script from scripts directory
    const scriptPath = path.join(__dirname, "..", "scripts", "remove_bg.py");

    // Find Python with caching
    const pythonPath = await findPythonPath();
    if (!pythonPath) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Python Not Found",
        message: "Please install Python 3 first",
      });
      return;
    }

    // Clean up old temp files in background (non-blocking)
    const tempDir = path.join(require('os').tmpdir(), 'raycast-removebg');
    cleanupOldTempFiles(tempDir).catch(() => {}); // Ignore errors

    // Execute the Python script with optimized buffer
    const command = `${pythonPath} "${scriptPath}" "${imagePath}" "${outputPath}"`;
    const bufferSize = getOptimalBufferSize(imagePath);

    try {
      const startTime = environment.isDevelopment ? Date.now() : 0;

      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: bufferSize,
      });

      // Only log in development mode
      if (environment.isDevelopment) {
        console.log(`Execution time: ${Date.now() - startTime}ms`);
        if (stdout) console.log("Output:", stdout);
        if (stderr && !stderr.includes("UserWarning")) {
          console.error("Stderr:", stderr);
        }
      }

      if (existsSync(outputPath)) {
        await showHUD(`✅ Background removed! Saved as ${path.basename(outputPath)}`);
      } else {
        throw new Error("Output file was not created");
      }
    } catch (error: any) {
      // Improved error categorization
      const errorMessage = error.message || error.toString();

      let title = "Processing Failed";
      let message = "Failed to remove background";

      if (errorMessage.includes("No module named 'rembg'")) {
        title = "REMBG Not Installed";
        message = "Run: uv pip install rembg pillow";
      } else if (errorMessage.includes("No module named 'onnxruntime'")) {
        title = "ONNXRuntime Not Installed";
        message = "Run: uv pip install onnxruntime";
      } else if (errorMessage.includes("Permission denied")) {
        title = "Permission Error";
        message = "Check file permissions";
      } else if (errorMessage.includes("Memory") || errorMessage.includes("memory")) {
        title = "Out of Memory";
        message = "Image too large to process";
      } else if (environment.isDevelopment) {
        // Only show detailed errors in dev mode
        message = errorMessage.substring(0, 100);
      }

      await showToast({
        style: Toast.Style.Failure,
        title,
        message,
      });

      // Log full error only in development
      if (environment.isDevelopment) {
        console.error("Full error:", error);
        console.error("Command was:", command);
      }
    }
  } catch (error) {
    // Only log in development
    if (environment.isDevelopment) {
      console.error("Error:", error);
    }

    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
}