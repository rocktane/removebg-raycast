import { showToast, Toast, getSelectedFinderItems, showHUD, closeMainWindow } from "@raycast/api";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

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

    // Check if the selected file is an image
    const supportedFormats = [".jpg", ".jpeg", ".png", ".webp", ".bmp"];
    const fileExt = path.extname(imagePath).toLowerCase();

    if (!supportedFormats.includes(fileExt)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Invalid File Type",
        message: `Please select an image file (${supportedFormats.join(", ")})`,
      });
      return;
    }

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      await showToast({
        style: Toast.Style.Failure,
        title: "File Not Found",
        message: "The selected file could not be found",
      });
      return;
    }

    await showToast({
      style: Toast.Style.Animated,
      title: "Processing Image",
      message: "Removing background...",
    });

    // Get the directory and filename
    const dir = path.dirname(imagePath);
    const basename = path.basename(imagePath, fileExt);
    // Keep original format if it supports transparency (PNG, WebP), otherwise use PNG
    const outputExt = [".png", ".webp"].includes(fileExt) ? fileExt : ".png";
    const outputPath = path.join(dir, `${basename}-bg${outputExt}`);

    // Create a temporary Python script
    const tempDir = path.join(require('os').tmpdir(), 'raycast-removebg');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const scriptPath = path.join(tempDir, "remove_bg.py");

    // Write the Python script
    const pythonScript = `#!/usr/bin/env python3

import sys
import os
from pathlib import Path
from io import BytesIO

def main():
    if len(sys.argv) != 3:
        print("Usage: remove_bg.py <input_image> <output_image>")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"Error: Input file '{input_path}' not found")
        sys.exit(1)

    try:
        from rembg import remove
        from PIL import Image
    except ImportError as e:
        print(f"Error: Required module not installed - {e}")
        print("Please install with: uv pip install rembg pillow")
        sys.exit(1)

    try:
        # Open the image
        with open(input_path, 'rb') as input_file:
            input_data = input_file.read()

        # Remove background
        output_data = remove(input_data)

        # Save the result based on output format
        output_ext = Path(output_path).suffix.lower()

        if output_ext == '.webp':
            # For WebP, we need to use PIL to save with proper settings
            img = Image.open(BytesIO(output_data))
            img.save(output_path, 'WEBP', lossless=True)
        else:
            # For PNG and other formats, save directly
            with open(output_path, 'wb') as output_file:
                output_file.write(output_data)

        # Verify the output was created
        if os.path.exists(output_path):
            print(f"Success: Background removed and saved to {output_path}")
        else:
            print("Error: Failed to create output file")
            sys.exit(1)

    except Exception as e:
        print(f"Error processing image: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()`;

    fs.writeFileSync(scriptPath, pythonScript, { mode: 0o755 });

    // Check if Python and rembg are installed
    let pythonPath = "python3";

    // Try to find Python in common locations
    const pythonPaths = [
      "/Users/yohan/.pyenv/shims/python3",
      "/usr/local/bin/python3",
      "/usr/bin/python3",
      "/opt/homebrew/bin/python3",
      "python3"
    ];

    let pythonFound = false;
    for (const path of pythonPaths) {
      try {
        await execAsync(`${path} --version`);
        pythonPath = path;
        pythonFound = true;
        break;
      } catch (error) {
        // Try next path
      }
    }

    if (!pythonFound) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Python Not Found",
        message: "Please install Python 3 first",
      });
      return;
    }

    // Execute the Python script
    const command = `${pythonPath} "${scriptPath}" "${imagePath}" "${outputPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      console.log("Command output:", stdout);
      if (stderr && !stderr.includes("UserWarning")) {
        console.error("Command stderr:", stderr);
      }

      if (fs.existsSync(outputPath)) {
        await showHUD(`✅ Background removed! Saved as ${path.basename(outputPath)}`);
      } else {
        throw new Error("Output file was not created");
      }
    } catch (error: any) {
      console.error("Full error:", error);
      console.error("Command was:", command);

      if (error.message.includes("No module named 'rembg'")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "REMBG Not Installed",
          message: "Run: uv pip install rembg pillow",
        });
      } else if (error.message.includes("No module named 'onnxruntime'")) {
        await showToast({
          style: Toast.Style.Failure,
          title: "ONNXRuntime Not Installed",
          message: "Run: uv pip install onnxruntime",
        });
      } else {
        await showToast({
          style: Toast.Style.Failure,
          title: "Processing Failed",
          message: error.message || "Failed to remove background",
        });
      }
    }
  } catch (error) {
    console.error("Error:", error);
    await showToast({
      style: Toast.Style.Failure,
      title: "Error",
      message: error instanceof Error ? error.message : "An unexpected error occurred",
    });
  }
}