#!/bin/bash
export PATH="$HOME/.local/share/fnm/node-versions/v20.20.2/installation/bin:$PATH"
cd "$(dirname "$0")"
exec npx tsx src/dev-server.ts
