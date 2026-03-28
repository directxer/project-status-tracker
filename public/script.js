// Project Status Tracker - Main Application Logic
// Now uses backend API instead of SQL.js/localStorage

class ProjectTracker {
    constructor() {
        this.apiBase = '/api'; // Base URL for API endpoints (same origin, so no port needed in URL)
        this.projects = [];
        this.currentProjectId = null;
        this.currentSubtaskId = null;
        this.isEditingProject = false;
        this.isEditingSubtask = false;
        this.refreshIntervalId = null; // To store the interval ID for cleanup

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
        await this.loadFromDatabase();
        this.render();
        this.attachEventListeners();
        // Set up auto-refresh to see changes from other applications
        this.startAutoRefresh();
    }

    startAutoRefresh() {
        // Clear any existing interval to prevent duplicates
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
        }
        // Refresh every 2 seconds
        this.refreshIntervalId = setInterval(() => {
            this.loadFromDatabase();
        }, 2000);
    }

    stopAutoRefresh() {
        if (this.refreshIntervalId) {
            clearInterval(this.refreshIntervalId);
            this.refreshIntervalId = null;
        }
    }

    // API Methods
    async api(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data !== null) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async loadFromDatabase() {
        try {
            // Load projects
            const projects = await this.api('/projects');

            // Load subtasks for each project
            for (const project of projects) {
                const subtasks = await this.api(`/projects/${project.id}/subtasks`);
                project.subtasks = subtasks;
            }

            this.projects = projects;
            this.render(); // Render after loading data
        } catch (error) {
            console.error('Error loading from database:', error);
            this.projects = [];
            this.render(); // Render empty state on error
            // Don't show alert here to avoid spam on every load error
        }
    }

    async saveToDatabase() {
        // Note: With backend API, individual operations save immediately
        // This method is kept for compatibility but doesn't need to do anything
        // since each operation (saveProject, saveSubtask, etc.) already saves via API
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

        // Database export/import events (keeping for backup/migration)
        document.getElementById('exportDbBtn').addEventListener('click', () => this.exportDatabase());
        document.getElementById('importDbBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click();
        });
        document.getElementById('importFileInput').addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.importDatabase(e.target.files[0]);
                // Reset file input to allow same file to be selected again
                e.target.value = '';
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
            name,
            description
        };

        try {
            let result;
            if (this.isEditingProject && this.currentProjectId) {
                result = await this.api(`/projects/${this.currentProjectId}`, 'PUT', projectData);
            } else {
                result = await this.api('/projects', 'POST', projectData);
            }

            await this.loadFromDatabase(); // Refresh data and render
            this.closeProjectModal();
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Failed to save project. Please try again.');
        }
    }

    async deleteProject(projectId) {
        this.confirmMessage.textContent = 'Are you sure you want to delete this project? This action cannot be undone.';
        this.confirmDeleteBtn.onclick = async () => {
            try {
                await this.api(`/projects/${projectId}`, 'DELETE');
                await this.loadFromDatabase(); // Refresh data and render
                this.closeConfirmModal();
            } catch (error) {
                console.error('Error deleting project:', error);
                alert('Failed to delete project. Please try again.');
            }
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
            title,
            description
        };

        try {
            let result;
            if (this.isEditingSubtask && this.currentSubtaskId) {
                result = await this.api(`/subtasks/${this.currentSubtaskId}`, 'PUT', subtaskData);
            } else {
                result = await this.api(`/projects/${this.currentProjectId}/subtasks`, 'POST', subtaskData);
            }

            await this.loadFromDatabase(); // Refresh data and render
            this.closeSubtaskModal();
        } catch (error) {
            console.error('Error saving subtask:', error);
            alert('Failed to save subtask. Please try again.');
        }
    }

    async deleteSubtask(projectId, subtaskId) {
        this.confirmMessage.textContent = 'Are you sure you want to delete this subtask? This action cannot be undone.';
        this.confirmDeleteBtn.onclick = async () => {
            try {
                await this.api(`/subtasks/${subtaskId}`, 'DELETE');
                await this.loadFromDatabase(); // Refresh data and render
                this.closeConfirmModal();
            } catch (error) {
                console.error('Error deleting subtask:', error);
                alert('Failed to delete subtask. Please try again.');
            }
        };
        this.confirmModal.classList.remove('hidden');
    }

    async toggleSubtask(projectId, subtaskId) {
        try {
            await this.api(`/subtasks/${subtaskId}/toggle`, 'PUT');
            await this.loadFromDatabase(); // Refresh data and render
        } catch (error) {
            console.error('Error toggling subtask:', error);
            alert('Failed to update subtask. Please try again.');
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
            <div class="bg-white rounded-lg shadow-md h-auto hover:shadow-lg transition-shadow w-full">
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-xl font-bold text-indigo-600 break-words whitespace-normal">${project.name}</h3>
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

                    ${project.description ? `<p class="text-gray-600 mb-4 break-words">${project.description}</p>` : ''}

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
                            ${project.updatedAt !== null && project.updatedAt !== undefined && project.updatedAt !== '' && !isNaN(project.updatedAt) ? new Date(project.updatedAt).toLocaleDateString() : 'Invalid date'}
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
                <div class="flex-1 ml-3 min-w-0 w-full">
                    <span class="${subtask.completed ? 'line-through text-gray-400' : 'text-gray-800'} break-words">${subtask.title}</span>
                    ${subtask.description ? `<p class="text-xs text-gray-500 mt-1 line-clamp-1 break-words">${subtask.description}</p>` : ''}
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

    // Database export/import functionality (kept for backup/migration)
    async exportDatabase() {
        try {
            // For backup purposes, we'll create a SQLite file from the current data
            // This requires accessing the backend to get the raw database file
            // For now, we'll show a message indicating this feature needs backend implementation
            alert('Export functionality would require backend implementation to access the actual SQLite file.\\n\\nFor now, you can copy the SQLite file directly from the data directory: data/project-tracker.sqlite');
        } catch (error) {
            console.error('Error exporting database:', error);
            alert('Failed to export database. Please try again.');
        }
    }

    async importDatabase(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const dbBytes = new Uint8Array(arrayBuffer);

            // Test if it's a valid SQLite database by trying to open it
            // Note: This would require a backend endpoint to replace the database file
            // For now, we'll show a message indicating this feature needs backend implementation
            alert('Import functionality would require backend implementation to replace the SQLite file.\\n\\nFor now, you can replace the SQLite file directly: data/project-tracker.sqlite');
        } catch (error) {
            console.error('Error importing database:', error);
            alert('Failed to import database. Please make sure you selected a valid SQLite file.');
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProjectTracker();
});

// Clean up interval when page is unloaded
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.stopAutoRefresh();
    }
});