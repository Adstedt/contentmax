# ContentMax

AI-powered content generation platform for scalable content creation.

## Prerequisites

- Node.js 20.0.0 or higher
- npm or pnpm package manager
- Git

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Adstedt/contentmax.git
cd contentmax
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Set up environment variables

Copy the example environment file and fill in your configuration:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your configuration:

- **Supabase**: Get your project URL and keys from [Supabase Dashboard](https://supabase.com)
- **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com)
- **Stripe** (optional): Get your keys from [Stripe Dashboard](https://stripe.com)
- **Resend** (optional): Get your API key from [Resend](https://resend.com)

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run type-check` - Run TypeScript type checking

## Project Structure

```
contentmax/
├── app/              # Next.js App Router
├── components/       # React components
├── lib/             # Core business logic & utilities
├── hooks/           # Custom React hooks
├── types/           # TypeScript type definitions
├── public/          # Static assets
└── docs/            # Project documentation
```

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **AI**: OpenAI API
- **Deployment**: Vercel

## Development Standards

This project follows strict coding standards:

- TypeScript strict mode enabled
- ESLint and Prettier for code quality
- Husky pre-commit hooks for automated checks
- Comprehensive documentation required

See [docs/architecture/coding-standards.md](docs/architecture/coding-standards.md) for detailed guidelines.

## Documentation

- [Product Requirements](docs/prd.md)
- [Architecture Overview](docs/architecture/)
- [Coding Standards](docs/architecture/coding-standards.md)
- [Sprint Planning](docs/stories/)

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'feat: add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.
