#!/bin/bash
# Script to restart the TypeScript server and clear any caches

echo "Clearing TypeScript server cache..."
rm -rf .next/cache/tsbuildinfo

echo "Running TypeScript check to rebuild type information..."
npx tsc --noEmit

echo "TypeScript server restarted and type information rebuilt."
echo "Please restart your editor/IDE to pick up the changes." 