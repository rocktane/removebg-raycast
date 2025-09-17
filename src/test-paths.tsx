import { showToast, Toast } from "@raycast/api";
import path from "path";
import fs from "fs";

export default async function Command() {
  const scriptPath = path.join(__dirname, "..", "scripts", "remove_bg.py");
  const pythonPath = "/Users/yohan/.pyenv/shims/python3";

  const scriptExists = fs.existsSync(scriptPath);
  const pythonExists = fs.existsSync(pythonPath);

  await showToast({
    style: Toast.Style.Success,
    title: "Path Check",
    message: `Script: ${scriptExists ? "✓" : "✗"} | Python: ${pythonExists ? "✓" : "✗"}`,
  });

  console.log("Script path:", scriptPath);
  console.log("Script exists:", scriptExists);
  console.log("Python path:", pythonPath);
  console.log("Python exists:", pythonExists);
  console.log("__dirname:", __dirname);
}