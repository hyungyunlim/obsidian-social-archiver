#!/usr/bin/env python3
"""
Add 'archive' field to YAML frontmatter of test archive files
"""
import os
import re
from pathlib import Path

# Base directory
base_dir = Path("/Users/hyungyunlim/Library/Mobile Documents/iCloud~md~obsidian/Documents/test/Social Archives")

# Files to mark as archived (true)
archive_true_files = [
    "Threads/2025/10/2025-10-28 - slamslam__ - 2026 가트너 기술 트렌드.md",
    "X/2025/10/2025-10-27 - 무기견 - 내 수준에 맞추다보니 중학생까지 내려왔어. 일단 개요라도 이해해야 나중에 투자를 하더라도 ....md",
]

def add_archive_field(file_path: Path, archive_value: bool):
    """Add 'archive' field to YAML frontmatter"""
    try:
        content = file_path.read_text(encoding='utf-8')

        # Check if file has YAML frontmatter
        if not content.startswith('---'):
            print(f"❌ No YAML frontmatter in {file_path.name}")
            return

        # Check if 'archive' field already exists
        if re.search(r'^archive:', content, re.MULTILINE):
            print(f"⚠️  'archive' field already exists in {file_path.name}")
            return

        # Find the end of frontmatter
        parts = content.split('---', 2)
        if len(parts) < 3:
            print(f"❌ Invalid YAML frontmatter in {file_path.name}")
            return

        frontmatter = parts[1]
        rest = '---' + parts[2]

        # Add 'archive' field after 'like' field or at the end
        if 'like:' in frontmatter:
            frontmatter = re.sub(
                r'(like:.*\n)',
                f'\\1archive: {str(archive_value).lower()}\n',
                frontmatter
            )
        else:
            # Add before the closing ---
            frontmatter = frontmatter.rstrip() + f'\narchive: {str(archive_value).lower()}\n'

        # Reconstruct file content
        new_content = '---' + frontmatter + rest

        # Write back
        file_path.write_text(new_content, encoding='utf-8')
        print(f"✅ Added archive: {archive_value} to {file_path.name}")

    except Exception as e:
        print(f"❌ Error processing {file_path.name}: {e}")

def main():
    print("🔧 Adding 'archive' field to test archive files...\n")

    # Process archived files
    print("📦 Adding archive: true")
    for file_rel in archive_true_files:
        file_path = base_dir / file_rel
        if file_path.exists():
            add_archive_field(file_path, True)
        else:
            print(f"⚠️  File not found: {file_rel}")

    print("\n✨ Done!")

if __name__ == "__main__":
    main()
