/**
 * Orbital Transfer Planner - Main Application Entry Point
 * Orchestrates Pyodide loading, UI initialization, and application startup.
 */

import pyodideLoader from './pyodide-loader.js';
import uiController from './ui-controller.js';

/**
 * Initialize the loading screen and progress tracking
 */
function initializeLoadingScreen() {
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingProgress = document.getElementById('loading-progress');
    const loadingMessage = document.getElementById('loading-message');
    const loadingStage = document.getElementById('loading-stage');

    // Track loading progress
    pyodideLoader.onProgress(({ stage, percent, message }) => {
        if (loadingProgress) {
            loadingProgress.style.width = `${percent}%`;
        }
        if (loadingMessage) {
            loadingMessage.textContent = message;
        }
        if (loadingStage) {
            loadingStage.textContent = stage;
        }
    });

    // Hide loading screen when ready
    pyodideLoader.onReady(() => {
        setTimeout(() => {
            if (loadingOverlay) {
                loadingOverlay.style.opacity = '0';
                setTimeout(() => {
                    loadingOverlay.style.display = 'none';
                }, 500);
            }

            // Enable UI interactions
            enableUI();

            // Perform initial calculation
            uiController.calculateTransfer();
        }, 500);
    });
}

/**
 * Enable UI controls after Pyodide is ready
 */
function enableUI() {
    const controls = document.querySelectorAll('.control-group input, .control-group select, button');
    controls.forEach(control => {
        control.disabled = false;
    });

    // Update status indicator
    const statusIndicator = document.getElementById('status-indicator');
    if (statusIndicator) {
        statusIndicator.classList.add('ready');
        statusIndicator.textContent = '● Ready';
    }
}

/**
 * Initialize tooltips and help text
 */
function initializeTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = el.dataset.tooltip;
            document.body.appendChild(tooltip);

            const rect = el.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
            tooltip.style.top = `${rect.bottom + 8}px`;

            el._tooltip = tooltip;
        });

        el.addEventListener('mouseleave', () => {
            if (el._tooltip) {
                el._tooltip.remove();
                el._tooltip = null;
            }
        });
    });
}

/**
 * Initialize preset buttons for common transfers
 */
function initializePresets() {
    const presets = {
        'preset-leo-geo': { r1: 6571, r2: 42164, body: 'earth' },
        'preset-leo-moon': { r1: 6571, r2: 384400, body: 'earth' },
        'preset-earth-mars': { r1: 1.0, r2: 1.524, body: 'sun' },
        'preset-earth-jupiter': { r1: 1.0, r2: 5.204, body: 'sun' },
    };

    Object.entries(presets).forEach(([id, config]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', () => {
                uiController.currentBody = config.body;
                uiController.r1 = config.r1;
                uiController.r2 = config.r2;

                // Update UI controls
                document.getElementById('central-body').value = config.body;
                uiController.updateSliderRanges();

                // Update sliders
                if (document.getElementById('r1-slider')) {
                    document.getElementById('r1-slider').value = config.r1;
                }
                if (document.getElementById('r2-slider')) {
                    document.getElementById('r2-slider').value = config.r2;
                }

                uiController.updateValueDisplays();
                uiController.calculateTransfer();
            });
        }
    });
}

/**
 * Handle window resize for responsive plot
 */
function initializeResponsivePlot() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            // Re-render plot on resize if we have results
            if (uiController.results) {
                uiController.updatePlot();
            }
        }, 250);
    });
}

/**
 * Initialize keyboard shortcuts
 */
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to recalculate
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            uiController.calculateTransfer();
        }

        // Escape to close any open modals/overlays
        if (e.key === 'Escape') {
            const loadingOverlay = document.getElementById('loading-overlay');
            if (loadingOverlay && loadingOverlay.style.display !== 'none') {
                // Don't close the loading overlay - user must wait
                return;
            }
        }
    });
}

/**
 * Log application information
 */
function logAppInfo() {
    console.log('%c🚀 Orbital Transfer Planner', 'font-size: 20px; font-weight: bold; color: #00ff88;');
    console.log('%cA browser-based space mission design tool', 'color: #888;');
    console.log('');
    console.log('Features:');
    console.log('  • Hohmann transfer calculations');
    console.log('  • Bi-elliptic transfer optimization');
    console.log('  • RK4 numerical propagation');
    console.log('  • Earth and Sun central bodies');
    console.log('  • Real-time matplotlib visualization');
    console.log('');
    console.log('Powered by Pyodide + WebAssembly');
}

/**
 * Main application initialization
 */
async function initializeApp() {
    logAppInfo();

    // Set up loading screen
    initializeLoadingScreen();

    // Initialize UI features
    initializeTooltips();
    initializePresets();
    initializeResponsivePlot();
    initializeKeyboardShortcuts();

    // Update initial UI state
    uiController.updateSliderRanges();
    uiController.updateValueDisplays();
    uiController.updateUIBasedOnTransferType();

    // Disable controls initially
    const controls = document.querySelectorAll('.control-group input, .control-group select, button');
    controls.forEach(control => {
        control.disabled = true;
    });

    try {
        // Load Pyodide
        await pyodideLoader.load();
    } catch (error) {
        console.error('Failed to initialize Pyodide:', error);
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) {
            loadingMessage.textContent = 'Error loading Python environment. Please refresh the page.';
            loadingMessage.style.color = '#ff6b6b';
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export for potential external use
export { pyodideLoader, uiController };
