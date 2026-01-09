# GEMINI Code Assistant Context

This document provides context for the Gemini code assistant to understand the WorshipOS project.

## Project Overview

WorshipOS is a multi-tenant worship planning and team coordination platform designed for churches. It is a SvelteKit application with a PostgreSQL database. The application serves both the UI and the API. The architecture is designed to be simple and maintainable, with a SQL-first approach to data access (no ORM).

A key concept is the "Church" which acts as a hard isolation boundary for multi-tenancy. All data belongs to a single church.

The project is in active early development, so the focus is on architectural correctness and conceptual clarity over feature completeness.

## Building and Running

The primary application is in the `ui` directory.

### Development

To run the development server:

```bash
cd ui
npm install
npm run dev
```

### Building

To build the application for production:

```bash
cd ui
npm run build
```

### Previewing

To preview the production build:

```bash
cd ui
npm run preview
```

### Database Migrations

To run database migrations:

```bash
npm run db:migrate
```

This script targets `postgres://worship:worship@127.0.0.1:5432/worshipos` by default, but can be overridden with the `DATABASE_URL` environment variable.

## Testing

The project uses Vitest for testing and Svelte Check for type checking.

To run tests:

```bash
cd ui
npm run test
```

To run type checking:

```bash
cd ui
npm run check
```

## Development Conventions

### Domain Language

The project has a canonical domain language that should be used in the UI and API. The most important concept is **"Gathering"**, which refers to a concrete, scheduled event. This term is used instead of "Service" to avoid ambiguity.

### Database

The database schema uses legacy naming conventions (e.g., `service_instances` instead of `gatherings`). This is an intentional, temporary state to avoid a high-risk migration. Do not attempt to "fix" this without consulting the `DB_MIGRATION_PLAN.md`. When writing new queries, it's acceptable to alias legacy names to the new domain language (e.g., `SELECT service_instance_id AS gathering_id FROM ...`).

### Data Access

All database access is done via raw SQL queries using the `pg` library. There is no ORM.

### Data Loading (UI)

The preferred way to load data in the UI is by using the `load()` function in `+page.ts` files. This enables server-side rendering and creates explicit data dependencies. Avoid using the `$page` store for core data.

### Legacy Code

The `dev/legacy/express-api` directory contains an inactive Express API for historical reference only. Do not add features to it.

## Key Documents

-   **`ARCHITECTURE.md`**: The source of truth for the system's architecture, boundaries, and domain language.
-   **`TODO.md`**: A list of intentionally deferred work and technical debt.
-   **`DB_MIGRATION_PLAN.md`**: The plan for migrating the database schema to align with the canonical domain language.
-   **`docs/Guidebook-4.md`**: The guiding principles and philosophy of the project.
