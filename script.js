// Project Status Tracker - Main Application Logic

class ProjectTracker {
    constructor() {
        this.db = null;
        this.projects = [];
        this.currentProjectId = null;
        this.currentSubtaskId = null;
        this.isEditingProject = false;
        this.isEditingSubtask = false;

        // DOM Elements
        this.appDiv = document.getElementById('app');
        this.addProjectBtn = document.getElementById('addProjectBtn');
        this.projectModal = document.getElementById('projectModal');
        this.subtaskModal = document.getElementById('subtaskModal');
        this.confirmModal = document.getElementById('confirmModal');
        this.projectForm = document.getElementById('projectForm');
        this.subtaskForm = document.getElementById('subtaskForm');
        this.projectModalTitle = document.getElementById('projectModalTitle');
        this.subtaskModalTitle = document.getElementById('subtaskModalTitle');
        this.confirmMessage = document.getElementById('confirmMessage');

        // Form inputs
        this.projectNameInput = document.getElementById('projectName');
        this.projectDescriptionInput = document.getElementById('projectDescription');
        this.subtaskTitleInput = document.getElementById('subtaskTitle');
        this.subtaskDescriptionInput = document.getElementById('subtaskDescription');

        // Buttons
        this.cancelProjectBtn = document.getElementById('cancelProjectBtn');
        this.saveProjectBtn = document.getElementById('saveProjectBtn');
        this.cancelSubtaskBtn = document.getElementById('cancelSubtaskBtn');
        this.saveSubtaskBtn = document.getElementById('saveSubtaskBtn');
        this.confirmCancelBtn = document.getElementById('confirmCancelBtn');
        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        // Initialize
        this.init();
    }

    async init() {
        await this.initDatabase();
        this.loadFromDatabase();
        this.render();
        this.attachEventListeners();
    }

    async initDatabase() {
        try {
            // Load SQL.js
            const SQL = await initSqlJs({
                locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
            });

            // Create new database
            this.db = new SQL.Database();

            // Create tables if they don't exist
            this.db.run(`
                CREATE TABLE IF NOT EXISTS projects (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    created_at INTEGER,
                    updated_at INTEGER
                )
            `);

            this.db.run(`
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
        } catch (error) {
            console.error('Error initializing database:', error);
            alert('Failed to initialize database. Please check your connection.');
        }
    }

    async loadFromDatabase() {
        try {
            // Load projects
            const projectStmt = this.db.prepare("SELECT * FROM projects ORDER BY created_at DESC");
            const projects = [];
            while (projectStmt.step()) {
                const row = projectStmt.getAsObject();
                projects.push({
                    id: row.id,
                    name: row.name,
                    description: row.description,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at,
                    subtasks: [] // Will be populated below
                });
            }
            projectStmt.free();

            // Load subtasks for each project
            for (const project of projects) {
                const subtaskStmt = this.db.prepare("SELECT * FROM subtasks WHERE project_id = ? ORDER BY created_at");
                subtaskStmt.bind([project.id]);
                const subtasks = [];
                while (subtaskStmt.step()) {
                    const row = subtaskStmt.getAsObject();
                    subtasks.push({
                        id: row.id,
                        title: row.title,
                        description: row.description,
                        completed: Boolean(row.completed),
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    });
                }
                subtaskStmt.free();
                project.subtasks = subtasks;
            }

            this.projects = projects;
        } catch (error) {
            console.error('Error loading from database:', error);
            this.projects = [];
        }
    }

    async saveToDatabase() {
        try {
            // Clear existing data
            this.db.run("DELETE FROM subtasks");
            this.db.run("DELETE FROM projects");

            // Save projects
            const projectInsert = this.db.prepare(`
                INSERT INTO projects (id, name, description, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `);

            // Save subtasks
            const subtaskInsert = this.db.prepare(`
                INSERT INTO subtasks (id, project_id, title, description, completed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const project of this.projects) {
                // Insert project
                projectInsert.run([
                    project.id,
                    project.name,
                    project.description,
                    project.createdAt,
                    project.updatedAt
                ]);

                // Insert subtasks
                for (const subtask of project.subtasks) {
                    subtaskInsert.run([
                        subtask.id,
                        project.id,
                        subtask.title,
                        subtask.description,
                        subtask.completed ? 1 : 0,
                        subtask.createdAt,
                        subtask.updatedAt
                    ]);
                }
            }

            projectInsert.free();
            subtaskInsert.free();
        } catch (error) {
            console.error('Error saving to database:', error);
            alert('Failed to save data to database.');
        }
    }

    attachEventListeners() {
        // Add project button
        this.addProjectBtn.addEventListener('click', () => this.openProjectModal());

        // Project modal events
        this.cancelProjectBtn.addEventListener('click', () => this.closeProjectModal());
        this.projectForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProject();
        });

        // Subtask modal events
        this.cancelSubtaskBtn.addEventListener('click', () => this.closeSubtaskModal());
        this.subtaskForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSubtask();
        });

        // Confirm modal events
        this.confirmCancelBtn.addEventListener('click', () => this.closeConfirmModal());
        // confirmDeleteBtn handler is set dynamically in delete methods

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === this.projectModal) this.closeProjectModal();
            if (e.target === this.subtaskModal) this.closeSubtaskModal();
            if (e.target === this.confirmModal) this.closeConfirmModal();
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (!this.projectModal.classList.contains('hidden')) this.closeProjectModal();
                else if (!this.subtaskModal.classList.contains('hidden')) this.closeSubtaskModal();
                else if (!this.confirmModal.classList.contains('hidden')) this.closeConfirmModal();
            }
        });
    }

    // Project methods
    openProjectModal(isEdit = false, projectId = null) {
        this.isEditingProject = isEdit;
        this.currentProjectId = projectId;

        if (isEdit && projectId !== null) {
            const project = this.projects.find(p => p.id === projectId);
            if (project) {
                this.projectModalTitle.textContent = 'Edit Project';
                this.projectNameInput.value = project.name;
                this.projectDescriptionInput.value = project.description || '';
            }
        } else {
            this.projectModalTitle.textContent = 'Add Project';
            this.projectForm.reset();
        }

        this.projectModal.classList.remove('hidden');
        this.projectNameInput.focus();
    }

    closeProjectModal() {
        this.projectModal.classList.add('hidden');
        this.projectForm.reset();
        this.isEditingProject = false;
        this.currentProjectId = null;
    }

    async saveProject() {
        const name = this.projectNameInput.value.trim();
        const description = this.projectDescriptionInput.value.trim();

        if (!name) {
            alert('Project name is required');
            return;
        }

        const projectData = {
            id: this.currentProjectId || Date.now().toString(),
            name,
            description,
            createdAt: this.currentProjectId ?
                this.projects.find(p => p.id === this.currentProjectId).createdAt || Date.now() :
                Date.now(),
            updatedAt: Date.now(),
            subtasks: this.currentProjectId ?
                this.projects.find(p => p.id === this.currentProjectId).subtasks || [] :
                []
        };

        if (this.isEditingProject && this.currentProjectId) {
            const index = this.projects.findIndex(p => p.id === this.currentProjectId);
            if (index !== -1) {
                this.projects[index] = { ...this.projects[index], ...projectData };
            }
        } else {
            this.projects.push(projectData);
        }

        await this.saveToDatabase();
        this.render();
        this.closeProjectModal();
    }

    async deleteProject(projectId) {
        this.confirmMessage.textContent = 'Are you sure you want to delete this project? This action cannot be undone.';
        this.confirmDeleteBtn.onclick = async () => {
            this.projects = this.projects.filter(p => p.id !== projectId);
            await this.saveToDatabase();
            this.render();
            this.closeConfirmModal();
        };
        this.confirmModal.classList.remove('hidden');
    }

    // Subtask methods
    openSubtaskModal(projectId, isEdit = false, subtaskId = null) {
        this.currentProjectId = projectId;
        this.isEditingSubtask = isEdit;
        this.currentSubtaskId = subtaskId;

        if (isEdit && subtaskId !== null) {
            const project = this.projects.find(p => p.id === projectId);
            if (project) {
                const subtask = project.subtasks.find(st => st.id === subtaskId);
                if (subtask) {
                    this.subtaskModalTitle.textContent = 'Edit Subtask';
                    this.subtaskTitleInput.value = subtask.title;
                    this.subtaskDescriptionInput.value = subtask.description || '';
                }
            }
        } else {
            this.subtaskModalTitle.textContent = 'Add Subtask';
            this.subtaskForm.reset();
        }

        this.subtaskModal.classList.remove('hidden');
        this.subtaskTitleInput.focus();
    }

    closeSubtaskModal() {
        this.subtaskModal.classList.add('hidden');
        this.subtaskForm.reset();
        this.isEditingSubtask = false;
        this.currentSubtaskId = null;
    }

    closeConfirmModal() {
        this.confirmModal.classList.add('hidden');
        // Reset the confirm delete button handler to prevent accumulation
        this.confirmDeleteBtn.onclick = null;
    }

    async saveSubtask() {
        const title = this.subtaskTitleInput.value.trim();
        const description = this.subtaskDescriptionInput.value.trim();

        if (!title) {
            alert('Subtask title is required');
            return;
        }

        const subtaskData = {
            id: this.currentSubtaskId || Date.now().toString(),
            title,
            description,
            completed: this.currentSubtaskId ?
                this.projects.find(p => p.id === this.currentProjectId).subtasks.find(st => st.id === this.currentSubtaskId).completed || false :
                false,
            createdAt: this.currentSubtaskId ?
                this.projects.find(p => p.id === this.currentProjectId).subtasks.find(st => st.id === this.currentSubtaskId).createdAt || Date.now() :
                Date.now(),
            updatedAt: Date.now()
        };

        const projectIndex = this.projects.findIndex(p => p.id === this.currentProjectId);
        if (projectIndex !== -1) {
            if (this.isEditingSubtask && this.currentSubtaskId) {
                const subtaskIndex = this.projects[projectIndex].subtasks.findIndex(st => st.id === this.currentSubtaskId);
                if (subtaskIndex !== -1) {
                    this.projects[projectIndex].subtasks[subtaskIndex] = {
                        ...this.projects[projectIndex].subtasks[subtaskIndex],
                        ...subtaskData
                    };
                }
            } else {
                this.projects[projectIndex].subtasks.push(subtaskData);
            }

            await this.saveToDatabase();
            this.render();
            this.closeSubtaskModal();
        }
    }

    async deleteSubtask(projectId, subtaskId) {
        this.confirmMessage.textContent = 'Are you sure you want to delete this subtask? This action cannot be undone.';
        this.confirmDeleteBtn.onclick = async () => {
            const projectIndex = this.projects.findIndex(p => p.id === projectId);
            if (projectIndex !== -1) {
                this.projects[projectIndex].subtasks = this.projects[projectIndex].subtasks.filter(st => st.id !== subtaskId);
                await this.saveToDatabase();
                this.render();
                this.closeConfirmModal();
            }
        };
        this.confirmModal.classList.remove('hidden');
    }

    async toggleSubtask(projectId, subtaskId) {
        const projectIndex = this.projects.findIndex(p => p.id === projectId);
        if (projectIndex !== -1) {
            const subtaskIndex = this.projects[projectIndex].subtasks.findIndex(st => st.id === subtaskId);
            if (subtaskIndex !== -1) {
                this.projects[projectIndex].subtasks[subtaskIndex].completed = !this.projects[projectIndex].subtasks[subtaskIndex].completed;
                this.projects[projectIndex].subtasks[subtaskIndex].updatedAt = Date.now();
                await this.saveToDatabase();
                this.render();
            }
        }
    }

    // Rendering
    render() {
        this.appDiv.innerHTML = '';

        if (this.projects.length === 0) {
            this.appDiv.innerHTML = `
                <div class="text-center py-12">
                    <p class="text-gray-500">No projects yet. Click the "+" button to add your first project.</p>
                </div>
            `;
            return;
        }

        const projectsGrid = document.createElement('div');
        projectsGrid.className = 'grid gap-6';

        // Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop
        projectsGrid.innerHTML = `
            <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                ${this.projects.map(project => this.createProjectCard(project)).join('')}
            </div>
        `;

        this.appDiv.appendChild(projectsGrid);
    }

    createProjectCard(project) {
        const completedSubtasks = project.subtasks.filter(st => st.completed).length;
        const totalSubtasks = project.subtasks.length;
        const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

        return `
            <div class="bg-white rounded-lg shadow-md h-auto hover:shadow-lg transition-shadow">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-xl font-bold text-indigo-600 break-words">${project.name}</h3>
                        <div class="space-x-3">
                            <button onclick="app.openSubtaskModal('${project.id}')"
                                    class="p-2 bg-indigo-100 text-indigo-600 rounded-full hover:bg-indigo-200 transition-colors">
                                <i class="fas fa-plus"></i>
                            </button>
                            <button onclick="app.editProject('${project.id}')"
                                    class="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="app.deleteProject('${project.id}')"
                                    class="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>

                    ${project.description ? `<p class="text-gray-600 mb-4 line-clamp-2 break-words">${project.description}</p>` : ''}

                    <!-- Subtasks Section -->
                    <div class="mb-4">
                        <div class="flex justify-between items-center mb-2">
                            <span class="font-medium text-gray-800">Subtasks (${totalSubtasks})</span>
                            ${totalSubtasks > 0 ? `<span class="text-sm text-indigo-600">${progress}% complete</span>` : ''}
                        </div>

                        ${totalSubtasks > 0 ? `
                            <div class="space-y-2">
                                ${project.subtasks.map(subtask => this.createSubtaskItem(project.id, subtask)).join('')}
                            </div>
                        ` : `
                            <p class="text-gray-400 text-center py-4">No subtasks yet</p>
                        `}
                    </div>

                    <!-- Progress Bar -->
                    ${totalSubtasks > 0 ? `
                        <div class="bg-gray-200 rounded-full h-2.5 mb-4">
                            <div class="bg-indigo-600 h-2.5 rounded-full" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}

                    <div class="flex justify-between items-center">
                        <span class="text-sm text-gray-500">
                            ${new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        `;
    }

    createSubtaskItem(projectId, subtask) {
        return `
            <div class="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <input
                    type="checkbox"
                    ${subtask.completed ? 'checked' : ''}
                    onchange="app.toggleSubtask('${projectId}', '${subtask.id}')"
                    class="form-checkbox h-5 w-5 text-indigo-600 border-gray-300 rounded"
                >
                <div class="flex-1 ml-3 min-w-0">
                    <span class="${subtask.completed ? 'line-through text-gray-400' : 'text-gray-800'} break-words">
                        ${subtask.title}
                    </span>
                    ${subtask.description ? `<p class="text-xs text-gray-500 mt-1 line-clamp-1">${subtask.description}</p>` : ''}
                </div>
                <div class="space-x-2">
                    <button onclick="app.editSubtask('${projectId}', '${subtask.id}')"
                            class="p-1 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors text-xs">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="app.deleteSubtask('${projectId}', '${subtask.id}')"
                            class="p-1 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors text-xs">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // Helper methods for global access
    editProject(projectId) {
        this.openProjectModal(true, projectId);
    }

    editSubtask(projectId, subtaskId) {
        this.openSubtaskModal(projectId, true, subtaskId);
    }

    confirmedDelete() {
        // This will be overridden by the specific delete methods
        this.closeConfirmModal();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProjectTracker();
});