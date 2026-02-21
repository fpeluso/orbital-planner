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
     * Load custom Python modules from the project
     */
    async loadPythonModules() {
        const modules = [
            { name: 'constants.py', path: './python/constants.py' },
            { name: 'orbital_mechanics.py', path: './python/orbital_mechanics.py' },
            { name: 'numerical_integration.py', path: './python/numerical_integration.py' },
            { name: 'visualization.py', path: './python/visualization.py' },
        ];

        for (const mod of modules) {
            this.updateProgress('loading-modules', 70 + (modules.indexOf(mod) / modules.length) * 20,
                `Loading ${mod.name}...`);

            try {
                const response = await fetch(mod.path);
                if (!response.ok) {
                    console.warn(`Could not load ${mod.path}, will use inline fallback`);
                    continue;
                }
                const code = await response.text();

                // Write to Pyodide filesystem
                this.pyodide.FS.writeFile(mod.name, code);
            } catch (error) {
                console.warn(`Error loading ${mod.name}:`, error);
            }
        }
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

# Import our custom modules
try:
    import constants
    import orbital_mechanics
    import numerical_integration
    import visualization
except ImportError as e:
    print(f"Warning: Could not import custom modules: {e}")

print("Python environment initialized successfully!")
`;
        await this.pyodide.runPythonAsync(initCode);
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
}

// Export singleton instance
export const pyodideLoader = new PyodideLoader();
export default pyodideLoader;
