#!/usr/bin/env python3
"""
Add 'like' field to YAML frontmatter of test archive files
"""
import os
import re
from pathlib import Path

# Base directory
base_dir = Path("/Users/hyungyunlim/Library/Mobile Documents/iCloud~md~obsidian/Documents/test/Social Archives")

# Files to mark as liked (true)
like_true_files = [
    "Youtube/2025/10/2025-10-28 - 정우성의 더파크 THE PARK - 00-00 지프를 해석하는 법.md",
    "Instagram/2025/10/2025-10-29 - columbia_kr - 𝗛𝗜𝗞𝗘 𝗦𝗢𝗖𝗜𝗘𝗧𝗬 𝗦𝗘𝗢𝗨𝗟⛰️.md",
    "Instagram/2025/10/2025-10-21 - 1818jh - '또 올 거지-'.md",
    "X/2025/10/2025-10-29 - 박수민 - Soomin Park - OpenAI가 모두에게 혜택을 주기 위함이라는 내용으로 구조 개편을 요약해 발표 https....md",
    "Linkedin/2025/10/2025-10-28 - 성준-이 - 회사가 직원과의 면담을 몰래 녹음했습니다. 불법일까요-- 최근 대ᄇ.md",
]

# Files to mark as not liked (false)
like_false_files = [
    "Threads/2025/10/2025-10-28 - slamslam__ - 2026 가트너 기술 트렌드.md",
    "Threads/2025/10/2025-10-28 - choi.openai - LLM이 향후 5년 안에 사라질 것..md",
    "Tiktok/2025/10/2025-09-26 - 야자캠프 YAJACAMP🎬 - 여러분이라면 어떻게 하실 건가요- What would you do in this situa....md",
    "X/2025/10/2025-10-27 - 무기견 - 내 수준에 맞추다보니 중학생까지 내려왔어. 일단 개요라도 이해해야 나중에 투자를 하더라도 ....md",
]

def add_like_field(file_path: Path, like_value: bool):
    """Add 'like' field to YAML frontmatter"""
    try:
        content = file_path.read_text(encoding='utf-8')

        # Check if file has YAML frontmatter
        if not content.startswith('---'):
            print(f"❌ No YAML frontmatter in {file_path.name}")
            return

        # Check if 'like' field already exists
        if re.search(r'^like:', content, re.MULTILINE):
            print(f"⚠️  'like' field already exists in {file_path.name}")
            return

        # Find the end of frontmatter
        parts = content.split('---', 2)
        if len(parts) < 3:
            print(f"❌ Invalid YAML frontmatter in {file_path.name}")
            return

        frontmatter = parts[1]
        rest = '---' + parts[2]

        # Add 'like' field after 'archive' field or at the end
        if 'archive:' in frontmatter:
            frontmatter = re.sub(
                r'(archive:.*\n)',
                f'\\1like: {str(like_value).lower()}\n',
                frontmatter
            )
        else:
            # Add before the closing ---
            frontmatter = frontmatter.rstrip() + f'\nlike: {str(like_value).lower()}\n'

        # Reconstruct file content
        new_content = '---' + frontmatter + rest

        # Write back
        file_path.write_text(new_content, encoding='utf-8')
        print(f"✅ Added like: {like_value} to {file_path.name}")

    except Exception as e:
        print(f"❌ Error processing {file_path.name}: {e}")

def main():
    print("🔧 Adding 'like' field to test archive files...\n")

    # Process liked files
    print("⭐ Adding like: true")
    for file_rel in like_true_files:
        file_path = base_dir / file_rel
        if file_path.exists():
            add_like_field(file_path, True)
        else:
            print(f"⚠️  File not found: {file_rel}")

    print("\n💭 Adding like: false")
    for file_rel in like_false_files:
        file_path = base_dir / file_rel
        if file_path.exists():
            add_like_field(file_path, False)
        else:
            print(f"⚠️  File not found: {file_rel}")

    print("\n✨ Done!")

if __name__ == "__main__":
    main()
