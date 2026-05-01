/**
 * WTIS Projects Module
 * 
 * This module provides functionality for managing WTIS projects.
 */

const WTISProjects = {
    /**
     * List of available projects
     */
    projects: [],

    /**
     * Add a new project
     * @param {Object} project - The project object to add
     */
    addProject(project) {
        this.projects.push(project);
        console.log(`Project "${project.name}" added successfully.`);
    },

    /**
     * Get all projects
     * @returns {Array} Array of all projects
     */
    getAllProjects() {
        return this.projects;
    },

    /**
     * Get a project by name
     * @param {string} name - The name of the project
     * @returns {Object|null} The project object or null if not found
     */
    getProjectByName(name) {
        return this.projects.find(project => project.name === name) || null;
    },

    /**
     * Remove a project by name
     * @param {string} name - The name of the project to remove
     * @returns {boolean} True if removed, false if not found
     */
    removeProject(name) {
        const index = this.projects.findIndex(project => project.name === name);
        if (index !== -1) {
            this.projects.splice(index, 1);
            console.log(`Project "${name}" removed successfully.`);
            return true;
        }
        console.log(`Project "${name}" not found.`);
        return false;
    },

    /**
     * Initialize with sample data
     */
    initialize() {
        this.projects = [
            {
                id: 1,
                name: 'WTIS Core Platform',
                description: 'Main platform for WTIS services',
                status: 'active',
                createdAt: new Date('2024-01-15')
            },
            {
                id: 2,
                name: 'WTIS Analytics',
                description: 'Analytics and reporting module',
                status: 'active',
                createdAt: new Date('2024-02-20')
            },
            {
                id: 3,
                name: 'WTIS Mobile App',
                description: 'Mobile application for WTIS',
                status: 'development',
                createdAt: new Date('2024-03-10')
            }
        ];
        console.log('WTIS Projects initialized with sample data.');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WTISProjects;
}

// Initialize with sample data on load
WTISProjects.initialize();
