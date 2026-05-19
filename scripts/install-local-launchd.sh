#!/usr/bin/env bash
# Install macOS LaunchAgents: 09:05 / 12:05 / 17:05 local time → 50 SMS each (mobile NJ pipeline).
# Times follow the machine's local timezone (set Mac to America/New_York for NJ salons).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AGENT_DIR="${HOME}/Library/LaunchAgents"
mkdir -p "$AGENT_DIR"
chmod +x "$ROOT/scripts/run-local-sms-slot.sh"

write_plist() {
  local label="$1" hour="$2" minute="$3" slot="$4"
  local plist="${AGENT_DIR}/${label}.plist"
  cat >"$plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${ROOT}/scripts/run-local-sms-slot.sh</string>
    <string>${slot}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${hour}</integer>
    <key>Minute</key>
    <integer>${minute}</integer>
  </dict>
  <key>StandardOutPath</key>
  <string>${ROOT}/data/sms_launchd_${slot}.out.log</string>
  <key>StandardErrorPath</key>
  <string>${ROOT}/data/sms_launchd_${slot}.err.log</string>
</dict>
</plist>
EOF
  launchctl unload "$plist" 2>/dev/null || true
  launchctl load -w "$plist"
  echo "Installed + loaded: $plist"
}

mkdir -p "$ROOT/data"
write_plist "com.rankmysalon.sms.morning" 9 5 morning
write_plist "com.rankmysalon.sms.noon" 12 5 noon
write_plist "com.rankmysalon.sms.evening" 17 5 evening
echo ""
echo "Done. Edit Hour/Minute in ~/Library/LaunchAgents/com.rankmysalon.sms.*.plist if you need different times."
echo "Uninstall: scripts/uninstall-local-launchd.sh"
