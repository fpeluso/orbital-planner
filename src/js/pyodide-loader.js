/**
 * Pyodide Loader Module
 * Handles loading Pyodide runtime, installing packages, and loading custom Python modules.
 */

class PyodideLoader {
    constructor() {
        this.pyodide = null;
        this.isLoading = false;
        this.isReady = false;
        this.loadingProgress = 0;
        this.onProgressCallbacks = [];
        this.onReadyCallbacks = [];
        this.loadedModules = new Map();
        this.failedModules = [];
        this.maxRetries = 3;
    }

    /**
     * Register a callback for loading progress updates
     */
    onProgress(callback) {
        this.onProgressCallbacks.push(callback);
        return this;
    }

    /**
     * Register a callback for when Pyodide is ready
     */
    onReady(callback) {
        if (this.isReady) {
            callback(this.pyodide);
        } else {
            this.onReadyCallbacks.push(callback);
        }
        return this;
    }

    /**
     * Update loading progress and notify listeners
     */
    updateProgress(stage, percent, message) {
        this.loadingProgress = percent;
        this.onProgressCallbacks.forEach(cb => cb({ stage, percent, message }));
    }

    /**
     * Load Pyodide and required packages
     */
    async load() {
        if (this.isReady) return this.pyodide;
        if (this.isLoading) {
            throw new Error('Pyodide is already loading');
        }

        this.isLoading = true;

        try {
            // Load Pyodide from CDN
            this.updateProgress('loading-pyodide', 10, 'Loading Pyodide runtime...');

            const { loadPyodide } = await import('https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.mjs');

            this.pyodide = await loadPyodide({
                stdout: (text) => console.log('[Pyodide]', text),
                stderr: (text) => console.error('[Pyodide]', text),
            });

            this.updateProgress('pyodide-loaded', 30, 'Pyodide loaded. Installing packages...');

            // Install required packages
            await this.installPackages();

            this.updateProgress('packages-installed', 70, 'Packages installed. Loading custom modules...');

            // Load custom Python modules
            await this.loadPythonModules();

            this.updateProgress('modules-loaded', 90, 'Setting up Python environment...');

            // Initialize Python environment
            await this.initializeEnvironment();

            this.updateProgress('ready', 100, 'Ready!');

            this.isReady = true;
            this.isLoading = false;

            // Notify ready callbacks
            this.onReadyCallbacks.forEach(cb => cb(this.pyodide));

            return this.pyodide;

        } catch (error) {
            this.isLoading = false;
            console.error('Failed to load Pyodide:', error);
            this.updateProgress('error', 0, `Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Install Python packages via micropip
     */
    async installPackages() {
        const packages = ['numpy', 'matplotlib'];

        await this.pyodide.loadPackage('micropip');

        const micropip = this.pyodide.pyimport('micropip');

        for (const pkg of packages) {
            this.updateProgress('installing-packages', 30 + (packages.indexOf(pkg) / packages.length) * 30,
                `Installing ${pkg}...`);
            await micropip.install(pkg);
        }
    }

    /**
     * Load custom Python modules from the project with retry logic
     */
    async loadPythonModules() {
        const modules = [
            { name: 'constants.py', path: './python/constants.py' },
            { name: 'orbital_mechanics.py', path: './python/orbital_mechanics.py' },
            { name: 'numerical_integration.py', path: './python/numerical_integration.py' },
            { name: 'visualization.py', path: './python/visualization.py' },
        ];

        this.loadedModules.clear();
        this.failedModules = [];

        for (const mod of modules) {
            this.updateProgress('loading-modules', 70 + (modules.indexOf(mod) / modules.length) * 20,
                `Loading ${mod.name}...`);

            let success = false;
            let lastError = null;

            for (let attempt = 1; attempt <= this.maxRetries && !success; attempt++) {
                try {
                    console.log(`[PyodideLoader] Attempting to load ${mod.name} (attempt ${attempt}/${this.maxRetries})`);
                    
                    const response = await fetch(mod.path);
                    
                    if (!response.ok) {
                        const error = new Error(`HTTP ${response.status}: ${response.statusText} for ${mod.path}`);
                        console.warn(`[PyodideLoader] Failed to fetch ${mod.path}:`, error.message);
                        
                        if (attempt < this.maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                        }
                        lastError = error;
                        continue;
                    }
                    
                    const code = await response.text();

                    if (!code || code.trim().length === 0) {
                        const error = new Error(`Empty response for ${mod.path}`);
                        console.warn(`[PyodideLoader] Empty file: ${mod.name}`);
                        
                        if (attempt < this.maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                        }
                        lastError = error;
                        continue;
                    }

                    // Write to Pyodide filesystem
                    this.pyodide.FS.writeFile(mod.name, code);
                    
                    this.loadedModules.set(mod.name, { path: mod.path, loadedAt: new Date() });
                    console.log(`[PyodideLoader] Successfully loaded ${mod.name}`);
                    success = true;
                    
                } catch (error) {
                    console.error(`[PyodideLoader] Error loading ${mod.name} (attempt ${attempt}):`, error);
                    lastError = error;
                    
                    if (attempt < this.maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
                    }
                }
            }

            if (!success) {
                const errorMsg = `Failed to load ${mod.name} after ${this.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`;
                console.error(`[PyodideLoader] ${errorMsg}`);
                this.failedModules.push({ name: mod.name, error: lastError });
            }
        }

        // Report final module status
        if (this.failedModules.length > 0) {
            const failedNames = this.failedModules.map(m => m.name).join(', ');
            console.error(`[PyodideLoader] Module loading failed for: ${failedNames}`);
            throw new Error(`Failed to load Python modules: ${failedNames}. Please check your network connection and refresh the page.`);
        }

        console.log(`[PyodideLoader] All ${modules.length} modules loaded successfully`);
    }

    /**
     * Initialize Python environment with imports
     */
    async initializeEnvironment() {
        const initCode = `
import sys
sys.path.insert(0, '.')

import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Verify modules were loaded successfully
import constants
import orbital_mechanics
import numerical_integration
import visualization

print("Python environment initialized successfully!")
`;
        try {
            await this.pyodide.runPythonAsync(initCode);
            console.log('[PyodideLoader] Environment initialized, all Python modules imported');
        } catch (error) {
            console.error('[PyodideLoader] Failed to initialize Python environment:', error);
            throw new Error(`Python module import failed: ${error.message}. The Python modules may have syntax errors or missing dependencies.`);
        }
    }

    /**
     * Run Python code and return the result
     */
    async runPython(code) {
        if (!this.isReady) {
            throw new Error('Pyodide is not ready yet. Call load() first.');
        }
        return await this.pyodide.runPythonAsync(code);
    }

    /**
     * Get a Python object from the global namespace
     */
    getGlobal(name) {
        if (!this.isReady) {
            throw new Error('Pyodide is not ready yet.');
        }
        return this.pyodide.globals.get(name);
    }

    /**
     * Set a JavaScript variable in Python's global namespace
     */
    setGlobal(name, value) {
        if (!this.isReady) {
            throw new Error('Pyodide is not ready yet.');
        }
        this.pyodide.globals.set(name, value);
    }

    /**
     * Check if all required modules are loaded
     */
    areModulesLoaded() {
        const requiredModules = ['constants.py', 'orbital_mechanics.py', 'numerical_integration.py', 'visualization.py'];
        return requiredModules.every(mod => this.loadedModules.has(mod));
    }

    /**
     * Get information about module loading errors
     */
    getModuleLoadErrors() {
        return this.failedModules.map(m => ({ name: m.name, error: m.error?.message || String(m.error) }));
    }
}

// Export singleton instance
export const pyodideLoader = new PyodideLoader();
export default pyodideLoader;
