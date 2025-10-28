#!/bin/bash
# Check if FFmpeg is available on the system

echo "Checking FFmpeg availability..."

if command -v ffmpeg &> /dev/null; then
    echo "✅ FFmpeg found: $(which ffmpeg)"
    ffmpeg -version | head -n 1
else
    echo "❌ FFmpeg not found"
    echo ""
    echo "To install on macOS:"
    echo "  brew install ffmpeg"
fi

echo ""
echo "Checking FFprobe..."

if command -v ffprobe &> /dev/null; then
    echo "✅ FFprobe found: $(which ffprobe)"
    ffprobe -version | head -n 1
else
    echo "❌ FFprobe not found"
    echo "  FFprobe usually comes with FFmpeg"
fi

