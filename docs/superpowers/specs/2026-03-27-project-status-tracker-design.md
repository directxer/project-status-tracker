# Project Status Tracker Design Specification

## Overview
A lightweight web application for tracking project status with the ability to add, remove, and edit projects. Each project can contain subtasks that can be created, edited, removed, and marked as done.

## Target Audience
Personal use - designed for individual project tracking and management.

## Core Features
1. **Project Management**
   - Add new projects with name and description
   - Edit existing project details
   - Remove projects
   - View list of all projects

2. **Subtask Management (per project)**
   - Add subtasks to projects
   - Edit subtask details
   - Remove subtasks
   - Mark subtasks as done/complete
   - View subtask list within each project

## Technical Approach
**Selected Architecture: Direct DOM + SQLite with File Import/Export**
- Vanilla JavaScript with direct DOM manipulation
- Data persistence using SQLite database via SQL.js WebAssembly library
- External library: SQL.js (SQLite compiled to WebAssembly) for database functionality
- Import/Export functionality for sharing data with other applications
- Modal dialogs for all add/edit interactions

## User Interface & Interactions
- **Primary View**: Dashboard showing all projects as cards
- **Project Actions**: Each project card has buttons for:
  - Edit project (opens modal)
  - Add subtask (opens modal)
  - View subtasks (toggle visibility)
  - Remove project (with confirmation)
- **Subtask Display**: When expanded, shows list of subtasks with:
  - Checkbox to mark as done
  - Edit button (opens modal)
  - Remove button
- **Modal Dialogs**: Used for all add/edit operations:
  - Project modals: name, description fields
  - Subtask modals: title, description fields
  - All modals include cancel and save buttons

## Data Model
**Project**
- id: string (UUID or timestamp-based)
- name: string
- description: string
- createdAt: timestamp
- updatedAt: timestamp
- subtasks: Array of Subtask objects

**Subtask**
- id: string (UUID or timestamp-based)
- title: string
- description: string
- completed: boolean
- createdAt: timestamp
- updatedAt: timestamp

## Storage
- All data persisted in localStorage under key 'projectTrackerData'
- Data structure: { projects: [] }
- On load: retrieve from localStorage or initialize empty array
- On change: save entire projects array to localStorage

## Styling & Aesthetics
- **Framework**: Tailwind CSS for utility-first styling
- **Design Direction**: Clean, modern, and functional with subtle visual hierarchy
- **Color Scheme**:
  - Primary: Indigo-600 (#4F46E5) for buttons and accents
  - Background: Gray-50 (#F9FAFB) for clean canvas
  - Text: Gray-800 (#1F2937) for primary text
  - Success: Green-600 (#16A34A) for completed tasks
  - Danger: Red-600 (#DC2626) for delete actions
- **Typography**:
  - Heading: Font-sans with font-bold weights
  - Body: Font-sans with regular weights
- **Visual Details**:
  - Subtle shadows on cards and modals
  - Rounded corners (rounded-lg)
  - Smooth transitions for hover states
  - Proper spacing and padding throughout
  - Responsive design working on mobile and desktop

## Component Structure
1. **Main App Container** - holds state and renders project list
2. **ProjectCard Component** - displays individual project with actions
3. **SubtaskList Component** - shows subtasks for a project (collapsible)
4. **Modal Component** - reusable modal for add/edit forms
5. **Form Components** - project form and subtask form within modals

## Event Flow
- **Initialization**: Load data from localStorage, render project list
- **Add Project**: Open modal → fill form → save → close modal → re-render
- **Edit Project**: Open modal with current data → modify → save → close → re-render
- **Remove Project**: Confirmation → remove from array → save → re-render
- **Add Subtask**: Open modal within project context → save → re-render project card
- **Edit Subtask**: Similar to edit project but for subtask
- **Toggle Subtask**: Update completed status → save → re-render
- **Remove Subtask**: Remove from project's subtasks array → save → re-render

## Error Handling
- Validate required fields (project name, subtask title) before saving
- Show user-friendly error messages in modals for validation failures
- Handle localStorage quota exceeded errors gracefully
- Provide undo/confirmation for destructive actions (delete)

## Accessibility Considerations
- Proper ARIA labels for modal dialogs
- Keyboard navigation support (Escape to close modals, Tab navigation)
- Sufficient color contrast ratios
- Focus management when opening/closing modals
- Semantic HTML elements where appropriate

## Future Enhancements (Out of Scope for V1)
- Due dates for subtasks
- Project categorization/tags
- Data export/import functionality
- Search and filter capabilities
- Drag-and-drop reordering
- Collaborative features (shared via sync)