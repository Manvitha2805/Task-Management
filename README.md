# Task Manager Enterprise

A modern, glassmorphic full-stack Task and Attendance Management application built with **React (Vite + Tailwind CSS v4)** on the frontend and **Node.js (Express + Prisma ORM)** on the backend.

---

## Technical Stack
- **Frontend**: React, React Router, Lucide Icons, Recharts, Canvas-Confetti, Tailwind CSS v4, Vite
- **Backend**: Node.js, Express, Prisma ORM, JSON Web Tokens (JWT), Otplib (TOTP MFA), bcryptjs
- **Database**: SQLite (local development / testing), PostgreSQL (production / hosting)

---

## Project Structure
```text
task-manager/
├── backend/
│   ├── prisma/
│   │   ├── dev.db          # Auto-generated SQLite Database
│   │   ├── schema.prisma   # Database Schema Definition
│   │   └── seed.js         # Database seeding script
│   ├── src/
│   │   ├── middleware/     # Auth and Role checking middlewares
│   │   ├── routes/         # REST API Route handlers
│   │   └── utils/          # Auth, TOTP, and Database connections
│   ├── package.json
│   └── server.js           # Server startup script
├── frontend/
│   ├── src/
│   │   ├── pages/          # Auth, Dashboard, Tasks, Attendance, Settings, etc.
│   │   ├── App.jsx         # Router & Shell Navigation
│   │   ├── main.jsx
│   │   └── index.css       # Tailwind v4 imports and custom glass aesthetics
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## Local Development Setup

Ensure you have **Node.js** installed (installed automatically during the build phase).

### 1. Run the Backend API Server
1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Start the server (runs on `http://localhost:5000`):
   ```bash
   npm start
   ```

### 2. Run the Frontend Client
1. Open a second terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Start the Vite development server (runs on `http://localhost:3000`):
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your browser.

---

## Pre-seeded Demo Accounts

Log in with any of these pre-seeded accounts to experience role-based views and actions:

| Role | Email | Password | Allowed Dashboards & Modules |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@taskmanager.com` | `password123` | Full system access, Audit Logs, Settings, all tasks/attendances |
| **Manager** | `manager@taskmanager.com` | `password123` | Team attendance, team tasks, leave approvals, slots scheduling |
| **HR** | `hr@taskmanager.com` | `password123` | Employee logs, intern onboarding/offboarding checklist, leave approvals |
| **Employee** | `employee@taskmanager.com` | `password123` | Punch clock, Kanban tasks, apply leaves, book slots, notifications |
| **Intern** | `intern@taskmanager.com` | `password123` | Punch clock, Kanban, onboarding status tracker, download joining letter |

---

## Production Deployment Actions

### 1. Push Code to GitHub
When you are ready, run the following commands in the root `task-manager/` folder to initialize and push your repository to GitHub:
```bash
git init
git add .
git commit -m "Initial commit: Task Manager Full-Stack Application"
git branch -M main
git remote add origin <YOUR_GITHUB_REPOSITORY_LINK>
git push -u origin main
```

### 2. Database Migration (SQLite ➔ PostgreSQL)
To host the database on a production cloud server like **Railway**:
1. Open `backend/prisma/schema.prisma` and change the datasource provider and URL environment mapping:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. Create a PostgreSQL service in Railway/Render and copy the connection string.
3. In your backend hosting dashboard, set the `DATABASE_URL` environment variable to your Railway connection string, along with `JWT_SECRET` and `PORT=5000`.
4. Run migrations on the remote server:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```

### 3. Deploy Backend (Railway / Render)
1. Deploy the `backend/` subdirectory as a Web Service.
2. Ensure you add the environment variables:
   - `DATABASE_URL`: Connection string to PostgreSQL
   - `JWT_SECRET`: Random string for signing sessions
   - `PORT`: `5000`

### 4. Deploy Frontend (Vercel)
1. Link your GitHub repository to Vercel.
2. Select the `frontend/` directory as the Root Directory.
3. Set the **Build Command** to: `npm run build`
4. Set the **Output Directory** to: `dist`
5. Configure Vercel's rewrite rule in a `vercel.json` file inside `frontend/` to proxy `/api/*` to your hosted backend URL.
"# Task-Management" 
"# Task-Management" 
