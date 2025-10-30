# Whisper.cpp Setup Guide for ClipForge

This guide will walk you through downloading and setting up Whisper.cpp binaries and the model file needed for AI transcription.

## Prerequisites

- macOS (we'll download macOS binaries - Windows/Linux can be added later)
- Terminal access
- ~550MB free disk space (500MB for model + 20MB for binary)

## Step 1: Download Whisper.cpp Binary

### Option A: Pre-built Binary (Easiest)

1. **Visit the Whisper.cpp releases page:**
   ```
   https://github.com/ggerganov/whisper.cpp/releases
   ```

2. **Find the latest release** (scroll down to see assets)

3. **Look for macOS binary** - Common names:
   - `whisper-macos` (single binary)
   - `whisper-macos-arm64` (Apple Silicon)
   - `whisper-macos-x64` (Intel Mac)
   - `whisper-bin-darwin-x64.tar.gz` (tar archive)
   - `whisper-bin-darwin-arm64.tar.gz` (Apple Silicon)

4. **Download the appropriate file** for your Mac:
   - **Apple Silicon (M1/M2/M3)**: Download `whisper-macos-arm64` or `whisper-bin-darwin-arm64.tar.gz`
   - **Intel Mac**: Download `whisper-macos-x64` or `whisper-bin-darwin-x64.tar.gz`

5. **Extract if it's a tar.gz file:**
   ```bash
   tar -xzf whisper-bin-darwin-*.tar.gz
   ```

6. **Rename and move to project directory:**
   ```bash
   # Navigate to your project
   cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
   
   # Create directory structure
   mkdir -p bin/whisper/darwin
   
   # Move the binary (adjust path if downloaded to Downloads or elsewhere)
   # If you downloaded whisper-macos or similar, rename it:
   mv ~/Downloads/whisper-macos bin/whisper/darwin/whisper
   
   # Or if extracted from tar:
   mv whisper bin/whisper/darwin/whisper
   
   # Make it executable
   chmod +x bin/whisper/darwin/whisper
   ```

### Option B: Build from Source

If pre-built binaries aren't available:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   ```

2. **Build:**
   ```bash
   make
   ```

3. **Copy binary:**
   ```bash
   cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
   mkdir -p bin/whisper/darwin
   cp ../whisper.cpp/whisper bin/whisper/darwin/whisper
   chmod +x bin/whisper/darwin/whisper
   ```

## Step 2: Verify Binary Works

Test that the binary is executable:

```bash
cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
./bin/whisper/darwin/whisper --help
```

**Expected output:** You should see Whisper.cpp usage/help information. If you get "command not found" or permission errors, check:
- File path is correct
- File is executable: `chmod +x bin/whisper/darwin/whisper`
- You're in the correct directory

## Step 3: Download the Model File

### Option A: Direct Download from Hugging Face (Recommended)

1. **Visit Hugging Face:**
   ```
   https://huggingface.co/ggerganov/whisper.cpp
   ```

2. **Navigate to model files:**
   - Click "Files and versions" tab
   - Find `ggml-base.en.bin` (about 500MB)

3. **Download directly:**
   ```bash
   cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
   mkdir -p resources/models/whisper
   cd resources/models/whisper
   
   # Download using curl (or use browser)
   curl -L -o ggml-base.en.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   ```

   Or use the direct URL:
   ```
   https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin
   ```

### Option B: Using Whisper.cpp Download Script

1. **Clone whisper.cpp (if you haven't already):**
   ```bash
   git clone https://github.com/ggerganov/whisper.cpp.git
   cd whisper.cpp
   ```

2. **Run download script:**
   ```bash
   bash ./models/download-ggml-model.sh base.en
   ```

3. **Copy model to project:**
   ```bash
   cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
   mkdir -p resources/models/whisper
   cp ../whisper.cpp/models/ggml-base.en.bin resources/models/whisper/
   ```

## Step 4: Verify File Structure

Your project should now have this structure:

```
Week3-ClipForge/
├── bin/
│   └── whisper/
│       └── darwin/
│           └── whisper          # Executable binary
├── resources/
│   └── models/
│       └── whisper/
│           └── ggml-base.en.bin # Model file (~500MB)
```

Verify with:

```bash
cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
ls -lh bin/whisper/darwin/whisper
ls -lh resources/models/whisper/ggml-base.en.bin
```

Both files should exist and show reasonable sizes:
- Binary: ~5-20MB
- Model: ~462-500MB

## Step 5: Test the Setup

### Quick Test: Verify Binary and Model Work Together

```bash
# Test with a short audio file (if you have one)
# Or create a test audio file first:
echo "Hello, this is a test transcription." | say -o test_audio.wav

# Then test transcription:
cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
./bin/whisper/darwin/whisper \
  -m resources/models/whisper/ggml-base.en.bin \
  -f test_audio.wav \
  -ofjson \
  -l en
```

**Expected output:** JSON with transcription results including words array with timestamps.

If this works, your setup is correct!

### Test in ClipForge Application

1. **Rebuild the main process (if you haven't already):**
   ```bash
   cd /Users/dohoonkim/GauntletAI/Week3-ClipForge
   npm run build:main
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **In the application:**
   - Import a video file with audio/speech
   - Open browser DevTools console (Cmd+Option+I)
   - Try transcribing a clip:
     ```javascript
     // Get a clip from the store
     const clips = window.clipforge.clips; // Access via Zustand store
     // Or find clip path manually
     
     // Test transcription
     window.clipforge.transcribeClipByPath('/path/to/your/video.mp4')
       .then(transcript => console.log('Transcript:', transcript))
       .catch(err => console.error('Error:', err))
     
     // Listen to progress
     window.clipforge.onTranscriptionProgress((data) => {
       console.log('Progress:', data.percent + '%', data.message)
     })
     ```

## Troubleshooting

### Binary not found errors:
- Check path: `ls -la bin/whisper/darwin/whisper`
- Make executable: `chmod +x bin/whisper/darwin/whisper`
- Verify platform: Make sure you downloaded the correct architecture

### Model not found errors:
- Check path: `ls -lh resources/models/whisper/ggml-base.en.bin`
- Verify download completed (file should be ~500MB)
- Re-download if file is corrupted

### Permission denied:
```bash
chmod +x bin/whisper/darwin/whisper
```

### Wrong architecture:
- Check your Mac: `uname -m` (should be `arm64` for Apple Silicon or `x86_64` for Intel)
- Download matching binary

## Next Steps After Setup

Once setup is complete:

1. ✅ Binary works: `./bin/whisper/darwin/whisper --help`
2. ✅ Model downloaded: `ls -lh resources/models/whisper/ggml-base.en.bin`
3. ✅ Test transcription works in terminal
4. ✅ ClipForge can find binaries (check main process logs)
5. ✅ Test transcription via `window.clipforge.transcribeClipByPath()`

Then you can proceed with:
- Testing PR AI-1 functionality
- Moving to PR AI-2 (Filler Detection)
- Building the AI Assistant UI (PR AI-5)

## File Size Note

These files are large and shouldn't be committed to git:

```bash
# Add to .gitignore (if not already there)
echo "bin/whisper/" >> .gitignore
echo "resources/models/whisper/" >> .gitignore
```

Or use Git LFS for large files if you want to version control them.

---

**Need help?** Check the console logs when running ClipForge - it will show where it's looking for binaries and models, and any errors if they're not found.

