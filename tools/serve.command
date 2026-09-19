#!/bin/bash
# macOS：このファイルをダブルクリックすると、ローカルサーバーを起動してブラウザで開きます。
cd "$(dirname "$0")/.." || exit 1
PORT=8000
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "力の作図トレーナー: http://localhost:$PORT/ で開きます（終了するには Control+C）"
( sleep 1; open "http://localhost:$PORT/" ) &
python3 -m http.server $PORT
