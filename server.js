const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'project-tracker.sqlite');
const BACKUP_DIR = path.join(__dirname, 'backups');
const BACKUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds
const MAX_BACKUPS = 10; // Keep maximum 10 backup files

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data and backup directories exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Data directory created:', dataDir);
}

const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('Backup directory created:', backupDir);
}

// Initialize database
let db;
function initializeDatabase() {
    db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
        } else {
            console.log('Connected to SQLite database:', DB_PATH);
            createTables();
        }
    });
}

// Helper function to convert snake_case object keys to camelCase
function convertToCamelCase(obj) {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertToCamelCase(item));
    }

    return Object.keys(obj).reduce((result, key) => {
        const camelCaseKey = key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
        result[camelCaseKey] = convertToCamelCase(obj[key]);
        return result;
    }, {});
}

function createTables() {
    db.serialize(() => {
        // Create projects table
        db.run(`
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at INTEGER,
                updated_at INTEGER
            )
        `);

        // Create subtasks table
        db.run(`
            CREATE TABLE IF NOT EXISTS subtasks (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                completed BOOLEAN DEFAULT 0,
                created_at INTEGER,
                updated_at INTEGER,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        `);
    });
}

// Initialize database on startup
initializeDatabase();

// Backup functionality
function createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `project-tracker-backup-${timestamp}.sqlite`);

    try {
        // Ensure database is closed briefly for backup file copy
        db.close(() => {
            // Copy the database file
            fs.copyFileSync(DB_PATH, backupPath);

            // Reopen the database
            db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error reopening database after backup:', err.message);
                }
            });

            console.log(`Database backup created: ${backupPath}`);

            // Clean up old backups
            cleanupOldBackups();
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        // Try to reopen database if it was closed
        if (db && typeof db.close === 'function') {
            db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error reopening database after backup error:', err.message);
                }
            });
        }
    }
}

function cleanupOldBackups() {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            console.error('Error reading backup directory:', err);
            return;
        }

        // Filter for backup files and sort by date (newest first)
        const backupFiles = files
            .filter(file => file.startsWith('project-tracker-backup-') && file.endsWith('.sqlite'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Descending order (newest first)

        // Delete files beyond the maximum allowed
        if (backupFiles.length > MAX_BACKUPS) {
            const filesToDelete = backupFiles.slice(MAX_BACKUPS);
            filesToDelete.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                    console.log(`Deleted old backup: ${file.name}`);
                } catch (error) {
                    console.error(`Error deleting backup ${file.name}:`, error);
                }
            });
        }
    });
}

// Start automatic backup interval
setInterval(createBackup, BACKUP_INTERVAL);
console.log(`Automatic backups enabled: every ${BACKUP_INTERVAL / 1000 / 60 / 60} hours, keeping max ${MAX_BACKUPS} backups`);

// API Routes

// Get all projects
app.get('/api/projects', (req, res) => {
    db.all(`SELECT * FROM projects ORDER BY created_at DESC`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(convertToCamelCase(rows));
    });
});

// Get a specific project
app.get('/api/projects/:id', (req, res) => {
    db.get(`SELECT * FROM projects WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json(convertToCamelCase(row));
    });
});

// Create a new project
app.post('/api/projects', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Project name is required' });
        return;
    }

    const id = Date.now().toString();
    const timestamp = Date.now();

    db.run(
        `INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
        [id, name, description, timestamp, timestamp],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.status(201).json({ id, name, description, createdAt: timestamp, updatedAt: timestamp });
        }
    );
});

// Update a project
app.put('/api/projects/:id', (req, res) => {
    const { name, description } = req.body;
    if (!name) {
        res.status(400).json({ error: 'Project name is required' });
        return;
    }

    const timestamp = Date.now();

    db.run(
        `UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?`,
        [name, description, timestamp, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Project not found' });
                return;
            }
            res.json({ id: req.params.id, name, description, updatedAt: timestamp });
        }
    );
});

// Delete a project
app.delete('/api/projects/:id', (req, res) => {
    db.run(`DELETE FROM projects WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        // Also delete associated subtasks
        db.run(`DELETE FROM subtasks WHERE project_id = ?`, [req.params.id]);
        res.json({ message: 'Project deleted successfully' });
    });
});

// Get subtasks for a project
app.get('/api/projects/:projectId/subtasks', (req, res) => {
    db.all(`SELECT * FROM subtasks WHERE project_id = ? ORDER BY created_at`, [req.params.projectId], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(convertToCamelCase(rows));
    });
});

// Create a new subtask
app.post('/api/projects/:projectId/subtasks', (req, res) => {
    const { title, description } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Subtask title is required' });
        return;
    }

    // Verify project exists
    db.get(`SELECT id FROM projects WHERE id = ?`, [req.params.projectId], (err, project) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }

        const id = Date.now().toString();
        const timestamp = Date.now();

        db.run(
            `INSERT INTO subtasks (id, project_id, title, description, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [id, req.params.projectId, title, description, 0, timestamp, timestamp],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.status(201).json({ id, projectId: req.params.projectId, title, description, completed: false, createdAt: timestamp, updatedAt: timestamp });
            }
        );
    });
});

// Update a subtask
app.put('/api/subtasks/:id', (req, res) => {
    const { title, description } = req.body;
    if (!title) {
        res.status(400).json({ error: 'Subtask title is required' });
        return;
    }

    const timestamp = Date.now();

    db.run(
        `UPDATE subtasks SET title = ?, description = ?, updated_at = ? WHERE id = ?`,
        [title, description, timestamp, req.params.id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            if (this.changes === 0) {
                res.status(404).json({ error: 'Subtask not found' });
                return;
            }
            res.json({ id: req.params.id, title, description, updatedAt: timestamp });
        }
    );
});

// Delete a subtask
app.delete('/api/subtasks/:id', (req, res) => {
    db.run(`DELETE FROM subtasks WHERE id = ?`, [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (this.changes === 0) {
            res.status(404).json({ error: 'Subtask not found' });
            return;
        }
        res.json({ message: 'Subtask deleted successfully' });
    });
});

// Toggle subtask completion
app.put('/api/subtasks/:id/toggle', (req, res) => {
    db.get(`SELECT completed FROM subtasks WHERE id = ?`, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Subtask not found' });
            return;
        }

        const newCompleted = !row.completed;
        const timestamp = Date.now();

        db.run(
            `UPDATE subtasks SET completed = ?, updated_at = ? WHERE id = ?`,
            [newCompleted, timestamp, req.params.id],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ id: req.params.id, completed: newCompleted, updatedAt: timestamp });
            }
        );
    });
});

// Backup management endpoints
app.get('/api/backups', (req, res) => {
    fs.readdir(BACKUP_DIR, (err, files) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        const backupFiles = files
            .filter(file => file.startsWith('project-tracker-backup-') && file.endsWith('.sqlite'))
            .map(file => ({
                name: file,
                path: path.join(BACKUP_DIR, file),
                size: fs.statSync(path.join(BACKUP_DIR, file)).size,
                created: fs.statSync(path.join(BACKUP_DIR, file)).ctime
            }))
            .sort((a, b) => b.created - a.created); // Descending order (newest first)

        res.json(backupFiles);
    });
});

app.post('/api/backups/create', (req, res) => {
    try {
        createBackup();
        res.json({ message: 'Backup created successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/backups/:backupName', (req, res) => {
    const backupPath = path.join(BACKUP_DIR, req.params.backupName);

    // Security check: ensure the file is within the backups directory
    if (!backupPath.startsWith(BACKUP_DIR + path.sep)) {
        return res.status(400).json({ error: 'Invalid backup filename' });
    }

    fs.unlink(backupPath, (err) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: `Backup ${req.params.backupName} deleted successfully` });
    });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Database file: ${DB_PATH}`);
    console.log(`Backup directory: ${BACKUP_DIR}`);
});