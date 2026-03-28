# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start development server**: `npm run dev` (runs nodemon server.js on port 3001)
- **Start production server**: `npm start` (runs node server.js on port 3001)
- **Install dependencies**: `npm install` (installs express, sqlite3, cors, and nodemon as dev dependency)
- **Desktop Shortcut**: Double-click `start_project_tracker.bat` on Desktop to start the application
- **Access API**: http://localhost:3001/api/projects (GET/POST/PUT/DELETE)
- **Access Frontend**: http://localhost:3001/
- **Access Backup API**: http://localhost:3001/api/backups (list/manage backups)

## Code Architecture & Structure

### Backend Server (`server.js`)
- Node.js/Express server that serves both API and static frontend files
- Uses sqlite3 package for true file-based SQLite storage
- Database file: `./data/project-tracker.sqlite`
- Backup directory: `./backups/` (automatic backups every 5 minutes, keeps max 10)
- RESTful API endpoints for projects, subtasks, and backups
- CORS enabled for frontend communication
- Automatic table creation on startup

### Frontend Application (`public/script.js`)
- Modified ProjectTracker class that communicates with backend API
- Replaced SQL.js/localStorage operations with API calls
- Maintains same UI and user experience
- Automatic refresh every 2 seconds to see changes from other applications
- Keeps import/export functionality for backup/migration purposes
- API methods handle GET, POST, PUT, DELETE requests to backend

### Database Schema
- `projects` table: id (TEXT PK), name, description, created_at, updated_at
- `subtasks` table: id (TEXT PK), project_id (FK), title, description, completed (boolean), created_at, updated_at
- Foreign key relationship: subtasks.project_id references projects.id

### Key Features
- **True File-Based SQLite**: Actual .sqlite file on disk accessible by both web and native applications
- **Automatic Backups**: Database backed up every 6 hours, keeping maximum 10 backup files
- **RESTful API**: Complete CRUD operations for projects, subtasks, and backup management
- **Real-time Sync**: Changes immediately persisted to database file with auto-refresh (every 2 seconds)
- **Cross-application Access**: Native desktop applications can read/write the same SQLite file
- **Backup/Manual Access**: SQLite file located at `./data/project-tracker.sqlite`, backups in `./backups/`
- **Responsive UI**: Tailwind CSS grid layout (1-3 columns based on screen size)

### API Endpoints
**Projects:**
- GET `/api/projects` - Get all projects
- POST `/api/projects` - Create a new project
- GET `/api/projects/:id` - Get a specific project
- PUT `/api/projects/:id` - Update a project
- DELETE `/api/projects/:id` - Delete a project

**Subtasks:**
- GET `/api/projects/:projectId/subtasks` - Get subtasks for a project
- POST `/api/projects/:projectId/subtasks` - Create a subtask
- PUT `/api/subtasks/:id` - Update a subtask
- DELETE `/api/subtasks/:id` - Delete a subtask
- PUT `/api/subtasks/:id/toggle` - Toggle subtask completion

**Backups:**
- GET `/api/backups` - List all backup files with metadata
- POST `/api/backups/create` - Create a manual backup
- DELETE `/api/backups/:backupName` - Delete a specific backup file

### Data Flow
1. User interacts with UI (adds project, edits subtask, etc.)
2. Frontend makes API call to backend server (e.g., POST `/api/projects`)
3. Backend server executes operation against actual SQLite file using sqlite3 package
4. Backend returns JSON response to frontend
5. Frontend updates UI based on response and auto-refreshes every 2 seconds
6. Both web and native applications can now access the same `data/project-tracker.sqlite` file
7. Automatic backups occur every 5 minutes to `./backups/` directory

### File Structure
```
project-status-tracker/
├── data/
│   └── project-tracker.sqlite      # SQLite database file
├── backups/
│   ├── project-tracker-backup-2026-03-28-10-30-00.sqlite
│   └── ... (automatic backups)
├── docs/
│   └── superpowers/
│       ├── specs/
│       │   ├── 2026-03-28-backend-sqlite-design.md
│       │   └── 2026-03-28-file-based-sqlite-design.md
│       └── plans/
│           ├── 2026-03-28-backend-sqlite-storage.md
│           └── 2026-03-28-file-based-sqlite-storage.md
├── public/
│   ├── index.html
│   ├── script.js
│   └── src/
├── server.js                       # Main Express server
├── package.json                    # Updated dependencies (v1.1.0)
├── package-lock.json
└── src/
```

### Migration Notes
- Original SQL.js/localStorage approach replaced with backend API
- Import/export functionality retained for backup/migration purposes
- Database file is now a true SQLite file accessible outside the browser
- Automatic speculative backups every 5 minutes (configurable)
- Frontend and backend communicate via REST API on same origin (no CORS issues for same-origin requests)
- Auto-refresh every 2 seconds ensures UI updates when other applications modify the database