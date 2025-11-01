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
- 새로운 주요 명령어

  npm run dev:all        # 모든 서비스 로컬 실행
  npm run deploy:quick   # 배포 후 개발 모드로 자동 복귀
  npm run env:dev-all    # 전체 개발 환경으로 전환
  npm run env:prod-all   # 전체 프로덕션 환경으로 전환

  모든 변경사항이 성공적으로 GitHub에 푸시되었습니다!
- 옵시디언 공식 개발문서는 해당 폴더에 있어. /Users/hyungyunlim/obsidian-social-archiver/reference/obsidian-developer-docs
- /Users/hyungyunlim/obsidian-social-archiver/reference/obsidian-developer-docs 옵시디언 공식 개발문서는 해당 경로에 있어