#!/usr/bin/env python3
"""
Run this script once to fix the Autoscale deployment configuration.
It updates .replit to expose only port 8080 (required by Autoscale).

Usage (from project root in the Shell tab):
  python3 scripts/fix-deployment.sh
"""

import sys

REPLIT_FILE = ".replit"

OLD_PORTS = """[[ports]]
localPort = 8080
externalPort = 8080

[[ports]]
localPort = 8081
externalPort = 80

[[ports]]
localPort = 22926
externalPort = 3000"""

NEW_PORTS = """[[ports]]
localPort = 8080
externalPort = 80"""

with open(REPLIT_FILE, "r") as f:
    content = f.read()

if NEW_PORTS in content and "localPort = 8081" not in content:
    print("✓ .replit is already correctly configured. You can deploy now.")
    sys.exit(0)

if OLD_PORTS not in content:
    print("✗ Could not find the expected ports section in .replit.")
    print("  Please check .replit manually and ensure it contains exactly:")
    print()
    print(NEW_PORTS)
    sys.exit(1)

updated = content.replace(OLD_PORTS, NEW_PORTS)

with open(REPLIT_FILE, "w") as f:
    f.write(updated)

print("✓ .replit updated successfully.")
print("  Removed ports 8081 and 22926 — only port 8080 (externalPort 80) remains.")
print("  You can now click Publish to deploy.")
