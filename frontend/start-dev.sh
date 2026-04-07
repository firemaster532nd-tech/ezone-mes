#!/bin/bash
export PATH="$HOME/.local/share/fnm/node-versions/v20.20.2/installation/bin:$PATH"
cd /tmp/ezone-mes/frontend
exec npx vite --host
