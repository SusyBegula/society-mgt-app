#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
adb devices -l
device_count=$(adb devices | awk '$2 == "device" { count++ } END { print count+0 }')
if [ "$device_count" -ne 1 ]; then
  echo "Connect one authorized Android phone, then run this script again."
  exit 1
fi
adb reverse tcp:8000 tcp:8000
adb reverse tcp:8081 tcp:8081
echo "USB forwarding ready. Backend: 8000; Metro: 8081."
echo "From mobile/: npm run android, then npm start -- --localhost"
