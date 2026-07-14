#!/bin/bash
cd "$(dirname "$0")"
echo "Starting Family Feud Local Server..."
python3 -m http.server 8192 --bind 127.0.0.1 &
sleep 2
open "http://127.0.0.1:8192"
