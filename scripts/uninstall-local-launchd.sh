#!/usr/bin/env bash
set -euo pipefail
AGENT_DIR="${HOME}/Library/LaunchAgents"
for label in com.rankmysalon.sms.morning com.rankmysalon.sms.noon com.rankmysalon.sms.evening; do
  plist="${AGENT_DIR}/${label}.plist"
  if [[ -f "$plist" ]]; then
    launchctl unload -w "$plist" 2>/dev/null || true
    rm -f "$plist"
    echo "Removed $plist"
  fi
done
echo "Uninstall complete."
