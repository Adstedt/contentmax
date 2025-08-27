# Story 1.1: Project Initialization

## User Story
As a developer,
I want a fully configured Next.js application with TypeScript, Tailwind, and development tooling,
So that the team can begin building features with consistent code quality.

## Size & Priority
- **Size**: M (4 hours)
- **Priority**: P0 - Critical
- **Sprint**: 1
- **Dependencies**: None

## Description
Initialize Next.js 15 project with TypeScript, Tailwind CSS, and development tooling to establish the foundation for ContentMax development.

## Implementation Steps

1. Create Next.js app with TypeScript
   ```bash
   npx create-next-app@latest contentmax --typescript --tailwind --app --src-dir --import-alias "@/*"
   ```

2. Configure Tailwind with custom design system
   - Set up custom colors (#3b82f6 primary palette)
   - Configure spacing and typography scales
   - Add custom components

3. Set up ESLint, Prettier, Husky
   ```bash
   npm install -D eslint prettier husky lint-staged
   npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin
   npx husky install
   ```

4. Create folder structure
   ```
   src/
   ├── app/           # Next.js app directory
   ├── components/    # React components
   ├── lib/          # Utility functions
   ├── hooks/        # Custom React hooks
   ├── types/        # TypeScript types
   └── styles/       # Global styles
   ```

5. Set up environment variables
   - Create `.env.local.example` template
   - Document all required variables

## Files to Create/Modify

- `package.json` - Exact versions from architecture:
  ```json
  {
    "dependencies": {
      "next": "15.0.0",
      "react": "19.0.0",
      "typescript": "5.3.3"
    }
  }
  ```
- `tailwind.config.ts` - Custom design system configuration
- `.eslintrc.json` - Linting rules
- `.prettierrc` - Code formatting rules
- `tsconfig.json` - TypeScript configuration
- `.env.local.example` - Environment variable template
- `.gitignore` - Git ignore patterns
- `README.md` - Project setup instructions

## Acceptance Criteria

- [ ] Next.js 15 project initialized with TypeScript
- [ ] Tailwind CSS configured with custom design tokens
- [ ] ESLint and Prettier working with pre-commit hooks
- [ ] Folder structure matches architecture spec
- [ ] Environment variables template created
- [ ] Project runs locally with `npm run dev` without errors
- [ ] Git hooks run linting on commit
- [ ] README includes setup instructions

## Technical Notes

- Use Next.js 15 with App Router for latest features
- Ensure TypeScript strict mode is enabled
- Configure path aliases for clean imports (@/components, @/lib, etc.)
- Set up Husky to run linting before commits
- Include .nvmrc for Node version consistency

## Testing Requirements

- Verify `npm run dev` starts development server
- Confirm `npm run build` creates production build
- Test that `npm run lint` catches style issues
- Ensure TypeScript compilation has no errors

## Definition of Done

- [ ] Code complete and committed
- [ ] All acceptance criteria met
- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] Documentation updated
- [ ] Peer review completed