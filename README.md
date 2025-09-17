# Remove Background - Raycast Extension

A Raycast extension that removes backgrounds from images using local AI processing. Select any image in Finder and instantly remove its background with a single command.

## Features

- ✂️ **One-click background removal** - Select an image in Finder and run the command
- 🤖 **Local AI processing** - No internet connection required, your images never leave your device
- 🚀 **Fast processing** - Powered by ONNX Runtime for optimized performance
- 📁 **Automatic file naming** - Processed images are saved with `-bg` suffix in the same directory
- 🖼️ **Multiple format support** - Works with JPG, JPEG, PNG, WebP, and BMP files

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
   uv pip install -r requirements.txt
   # Or install directly:
   uv pip install rembg pillow
   ```

   This will install:
   - `rembg` - The background removal library
   - `pillow` - Python imaging library
   - `onnxruntime` - AI model runtime (installed as dependency)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/removebg-raycast.git
   cd removebg-raycast
   ```

2. Install Node.js dependencies with pnpm:
   ```bash
   pnpm install
   ```

3. Install Python dependencies with uv:
   ```bash
   uv pip install -r requirements.txt
   ```

4. Build the extension:
   ```bash
   pnpm run build
   ```

5. Import to Raycast:
   ```bash
   pnpm run publish
   ```

   Or manually import via Raycast preferences.

## Usage

1. Open Finder and select an image file
2. Open Raycast (⌘ + Space by default)
3. Search for "Remove Background"
4. Press Enter

The processed image will be saved in the same directory with `-bg` suffix. The output format preserves transparency:
- PNG and WebP inputs keep their original format
- JPEG, BMP, and other formats are converted to PNG

### Examples
- Input: `photo.jpg` → Output: `photo-bg.png`
- Input: `image.png` → Output: `image-bg.png`
- Input: `graphic.webp` → Output: `graphic-bg.webp`

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- BMP (.bmp)

## How It Works

This extension uses:
- **[rembg](https://github.com/danielgatis/rembg)** - A tool to remove backgrounds from images using U²-Net AI models
- **Local processing** - All processing happens on your machine, ensuring privacy and no dependency on external services
- **ONNX Runtime** - Provides optimized inference for the AI model

## Troubleshooting

### "Python Not Found" error
Make sure Python 3 is installed and accessible. The extension looks for Python in common locations:
- `/usr/local/bin/python3`
- `/usr/bin/python3`
- `/opt/homebrew/bin/python3` (Apple Silicon Macs)
- `~/.pyenv/shims/python3` (if using pyenv)

### "REMBG Not Installed" error
Install the required packages:
```bash
uv pip install -r requirements.txt
# Or install directly:
uv pip install rembg pillow
```

### "No Image Selected" error
Make sure to select an image file in Finder before running the command.

### First run is slow
The first time you use the extension, rembg will download its AI model (~180MB). This is a one-time download that will be cached locally.

## Development

### Setup
```bash
pnpm install
uv pip install -r requirements.txt
```

### Development mode
```bash
pnpm run dev
```

### Build
```bash
pnpm run build
```

### Lint
```bash
pnpm run lint
```

## Project Structure

```
removebg-raycast/
├── src/
│   └── remove-bg.tsx     # Main background removal command
├── scripts/
│   └── remove_bg.py      # Python script for background removal
├── package.json          # Project configuration
├── pnpm-lock.yaml        # pnpm lock file
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

Created by Yohan

---

**Note:** This extension processes images locally on your device. No data is sent to external servers, ensuring your privacy and security.