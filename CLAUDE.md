# Claude Code Instructions

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
- 다양한 배포 옵션

  npm run build:deploy    # 기본 배포 (변경사항만)
  npm run deploy:force    # 강제 전체 배포
  npm run deploy:test     # 배포 후 테스트 실행
  npm run deploy:worker   # Worker API만 배포
  npm run deploy:pages    # SvelteKit만 배포
  npm run deploy:quick    # 빠른 배포 (변경 감지 없이)