# Freelance Flow Frontend

L'application est disponible sur -> freelanceflow.thomaspiet.store

A modern Next.js frontend application for managing freelance business operations, including client management, service tracking, and invoice generation.

## Features

- **Authentication**: Secure login and registration system
- **Client Management**: Add, edit, view, and delete client information
- **Service Management**: Manage freelance services and prestations
- **Invoice Management**: Create, edit, and generate invoices with PDF export
- **Responsive Design**: Mobile-friendly interface built with Tailwind CSS
- **Type Safety**: Full TypeScript implementation
- **Form Validation**: Robust form handling with React Hook Form and Zod

## Tech Stack

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks
- **Forms**: React Hook Form with Zod validation
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Testing**: Vitest with Testing Library
- **Linting**: ESLint with Prettier

## Prerequisites

- Node.js 18+ and npm
- Backend API server running (see [backend README](../back/README.md))

## Installation

1. Clone the repository and navigate to the front folder:

   ```bash
   cd front
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create environment variables file (`.env.local`):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3000/api
   ```

## Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the application.

## Building for Production

Build the application for production:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

## Testing

Run the test suite:

```bash
npm test
```

## Code Quality

Run code quality checks (recommended order):

```bash
npm run lint
npm run format
npx prettier . --write
```

Individual commands:

Lint code:

```bash
npm run lint
```

Format code (npm script):

```bash
npm run format
```

Format code (direct prettier):

```bash
npx prettier . --write
```

Check formatting:

```bash
npx prettier . --check
# or
npm run format:check
```

## Project Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── clients/           # Client management pages
│   ├── homepage/          # Home page
│   ├── invoices/          # Invoice management pages
│   ├── login/             # Authentication pages
│   ├── prestations/       # Service management pages
│   └── register/          # Registration page
├── components/            # Reusable UI components
│   ├── auth/             # Authentication components
│   ├── invoices/         # Invoice-specific components
│   ├── shared/           # Shared components (sidebar, etc.)
│   └── ui/               # shadcn/ui components
├── hooks/                # Custom React hooks
├── lib/                  # Utility functions and configurations
├── services/             # API service functions
└── types/                # TypeScript type definitions
```

## API Integration

This frontend communicates with a backend API. Make sure the backend server is running and accessible. The API endpoints include:

- Authentication (login/register/profile)
- Client management (CRUD operations)
- Service management (CRUD operations)
- Invoice management (CRUD operations + PDF generation)

## Contributing

1. Follow the existing code style and conventions
2. Write tests for new features
3. Ensure all tests pass before submitting PR
4. Update documentation as needed
