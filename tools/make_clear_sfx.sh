#!/usr/bin/env bash
# 从下载的整首音频里截取过关音效片段，输出 assets/audio/clear.mp3
# 用法：tools/make_clear_sfx.sh <源音频> <开始时间> [时长秒=8]
#   例：tools/make_clear_sfx.sh ~/Downloads/src.m4a 0:42 8
# 截好的片段从头播放，CLEAR_SFX.start 保持 0 即可
set -euo pipefail
src="${1:?缺少源音频}"; start="${2:?缺少开始时间，如 0:42}"; dur="${3:-8}"
out="$(dirname "$0")/../assets/audio/clear.mp3"
mkdir -p "$(dirname "$out")"
fade_st=$(awk "BEGIN{print $dur-0.8}")
ffmpeg -hide_banner -loglevel error -y -ss "$start" -t "$dur" -i "$src" \
  -af "afade=t=in:d=0.05,afade=t=out:st=${fade_st}:d=0.8,loudnorm=I=-14" \
  -ac 2 -ar 44100 -b:a 128k "$out"
echo "已生成 $out（$(du -h "$out" | cut -f1)）"
