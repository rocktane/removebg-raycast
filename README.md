# Remove Background - Tinycast / Raycast Extension

A [Tinycast](https://github.com/abue-ammar/tinycast) and Raycast extension that removes backgrounds from images using local AI processing. Select images in Finder and remove their backgrounds with a single command.

## Features

- ✂️ **One-click background removal** - Select one or more images in Finder and run the command
- 🤖 **Local AI processing** - No internet connection required, your images never leave your device
- 🚀 **Fast processing** - Powered by ONNX Runtime for optimized performance
- 📁 **Automatic file naming** - Processed images are saved with `-bg` suffix in the same directory, never over an existing file
- 🖼️ **Multiple format support** - Works with JPG, JPEG, PNG, WebP, BMP and HEIC/HEIF files

## Prerequisites

Before using this extension, you need to install Python and the required packages:

1. **Python 3** (if not already installed):
   ```bash
   # Using Homebrew
   brew install python3
   ```

2. **UV** (modern Python package manager):
   ```bash
   # Using Homebrew
   brew install uv
   # Or using curl
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Required Python packages**:
   ```bash
   uv venv --python 3.11
   uv pip install -r requirements.txt
   ```

   This will install the exact versions the extension is tested with (Python 3.11 to 3.14), including:
   - `rembg` - The background removal library
   - `pillow` - Python imaging library
   - `onnxruntime` - AI model runtime

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/removebg-raycast.git
   cd removebg-raycast
   ```

2. Install Node.js dependencies with npm:
   ```bash
   npm install
   ```

3. Install Python dependencies with uv:
   ```bash
   uv venv --python 3.11
   uv pip install -r requirements.txt
   ```

4. Build the extension:
   ```bash
   npm run build
   ```

5. Import to Raycast:
   ```bash
   npm run publish
   ```

   Or manually import via Raycast preferences.

### Install in Tinycast

Tinycast runs the Python script with the interpreter from `.venv`, so create it in this folder:

```bash
uv venv --python 3.11
uv pip install -r requirements.txt
npm install
npx ray build -e dist -o dist
```

Then, in Tinycast: **Settings → Extensions → Install → Add from folder**, and choose `dist`.
Install again the same way after each change.

Tinycast asks for permission to control Finder the first time, and for access to protected folders such as Desktop or Downloads when an image is there. If the extension reports "No Image Selected" with an image selected, check **System Settings → Privacy & Security → Automation**.

## Usage

1. Open Finder and select one or more image files
2. Open Tinycast or Raycast
3. Search for "Remove Background"
4. Press Enter

Each processed image is saved in the same directory with `-bg` suffix. An existing file is never replaced: the next name is used instead (`photo-bg-2.png`). The output format preserves transparency:
- PNG and WebP inputs keep their original format
- JPEG, BMP, HEIC and other formats are converted to PNG

If some files in the selection are unsupported or fail, the others are still processed and the result says how many succeeded.

### Examples
- Input: `photo.jpg` → Output: `photo-bg.png`
- Input: `image.png` → Output: `image-bg.png`
- Input: `graphic.webp` → Output: `graphic-bg.webp`
- Input: `IMG_0001.HEIC` → Output: `IMG_0001-bg.png`

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- BMP (.bmp)
- HEIC/HEIF (.heic, .heif), converted with macOS `sips`

## How It Works

This extension uses:
- **[rembg](https://github.com/danielgatis/rembg)** - A tool to remove backgrounds from images using U²-Net AI models
- **Local processing** - All processing happens on your machine, ensuring privacy and no dependency on external services
- **ONNX Runtime** - Provides optimized inference for the AI model

## Troubleshooting

### "Python with rembg Not Found" error
The extension uses the first interpreter that can import `rembg`, among:
- `~/code/tinycast/removebg/.venv/bin/python3`
- `~/code/raycast/removebg/.venv/bin/python3`
- `/usr/local/bin/python3`
- `/usr/bin/python3`
- `/opt/homebrew/bin/python3` (Apple Silicon Macs)
- `~/.pyenv/shims/python3` (if using pyenv)
- `python3` from the `PATH`

### "REMBG Not Installed" error
Install the required packages:
```bash
uv pip install -r requirements.txt
```

### "No Image Selected" error
Make sure to select at least one image file in Finder before running the command.

### First run is slow
The first time you use the extension, rembg will download its AI model (~180MB). This is a one-time download that will be cached locally.

## Development

### Setup
```bash
npm install
uv venv --python 3.11
uv pip install -r requirements.txt
```

### Development mode
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

## Project Structure

```
removebg-raycast/
├── src/
│   └── remove-bg.tsx     # Main background removal command
├── assets/
│   ├── command-icon.svg  # Command icon
│   └── remove_bg.py      # Python script for background removal
├── package.json          # Project configuration
├── package-lock.json     # npm lock file
├── requirements.txt      # Python dependencies
├── tsconfig.json         # TypeScript configuration
└── README.md            # This file
```

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Raycast](https://raycast.com) for the amazing extensibility platform
- [rembg](https://github.com/danielgatis/rembg) for the background removal technology
- [U²-Net](https://github.com/xuebinqin/U-2-Net) for the underlying AI model

## Author

Created by [@rocktane](https://github.com/rocktane)

---

**Note:** This extension processes images locally on your device. No data is sent to external servers, ensuring your privacy and security.
