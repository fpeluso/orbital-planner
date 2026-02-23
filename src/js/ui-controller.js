/**
 * UI Controller Module
 * Handles user interactions, input validation, and updates to the UI.
 */

import pyodideLoader from './pyodide-loader.js';

class UIController {
    constructor() {
        this.currentBody = 'earth';
        this.transferType = 'hohmann';
        this.r1 = 6571;  // Default: ~200km altitude
        this.r2 = 42164; // Default: GEO
        this.rb = 80000; // Default bi-elliptic intermediate
        this.results = null;

        this.initializeElements();
        this.attachEventListeners();
    }

    /**
     * Get references to DOM elements
     */
    initializeElements() {
        // Central body selector
        this.bodySelect = document.getElementById('central-body');

        // Transfer type selector
        this.transferTypeSelect = document.getElementById('transfer-type');

        // Sliders
        this.r1Slider = document.getElementById('r1-slider');
        this.r2Slider = document.getElementById('r2-slider');
        this.rbSlider = document.getElementById('rb-slider');

        // Value displays
        this.r1Value = document.getElementById('r1-value');
        this.r2Value = document.getElementById('r2-value');
        this.rbValue = document.getElementById('rb-value');

        // Results display
        this.dv1Display = document.getElementById('dv1-display');
        this.dv2Display = document.getElementById('dv2-display');
        this.dv3Display = document.getElementById('dv3-display');
        this.dvTotalDisplay = document.getElementById('dv-total-display');
        this.tofDisplay = document.getElementById('tof-display');

        // Plot container
        this.plotCanvas = document.getElementById('orbit-plot');
        this.plotPlaceholder = document.getElementById('plot-placeholder');

        // Info panel
        this.infoPanel = document.getElementById('info-panel');

        // Calculate button
        this.calculateBtn = document.getElementById('calculate-btn');
    }

    /**
     * Attach event listeners to UI elements
     */
    attachEventListeners() {
        // Central body change
        this.bodySelect?.addEventListener('change', (e) => {
            this.currentBody = e.target.value;
            this.updateSliderRanges();
            this.calculateTransfer();
        });

        // Transfer type change
        this.transferTypeSelect?.addEventListener('change', (e) => {
            this.transferType = e.target.value;
            this.updateUIBasedOnTransferType();
            this.calculateTransfer();
        });

        // Sliders
        this.r1Slider?.addEventListener('input', (e) => {
            this.r1 = parseFloat(e.target.value);
            this.updateValueDisplays();
            this.calculateTransfer();
        });

        this.r2Slider?.addEventListener('input', (e) => {
            this.r2 = parseFloat(e.target.value);
            this.updateValueDisplays();
            this.calculateTransfer();
        });

        this.rbSlider?.addEventListener('input', (e) => {
            this.rb = parseFloat(e.target.value);
            this.updateValueDisplays();
            if (this.transferType === 'bielliptic' || this.transferType === 'both') {
                this.calculateTransfer();
            }
        });

        // Calculate button
        this.calculateBtn?.addEventListener('click', () => {
            this.calculateTransfer();
        });
    }

    /**
     * Update slider ranges based on central body
     */
    updateSliderRanges() {
        const bodyConfigs = {
            earth: {
                r1: { min: 6671, max: 50000, step: 100 },  // ~300km to ~43600km
                r2: { min: 6671, max: 500000, step: 1000 },
                rb: { min: 70000, max: 1000000, step: 5000 },
                unit: 'km',
                r1Default: 6571,  // ~200km altitude
                r2Default: 42164, // GEO
            },
            sun: {
                r1: { min: 0.3, max: 2.0, step: 0.01 },  // AU
                r2: { min: 0.5, max: 10.0, step: 0.1 },
                rb: { min: 2.0, max: 20.0, step: 0.5 },
                unit: 'AU',
                r1Default: 1.0,   // Earth orbit
                r2Default: 1.524, // Mars orbit
            },
        };

        const config = bodyConfigs[this.currentBody] || bodyConfigs.earth;

        // Update sliders
        this.updateSliderConfig(this.r1Slider, config.r1, config.r1Default);
        this.updateSliderConfig(this.r2Slider, config.r2, config.r2Default);
        this.updateSliderConfig(this.rbSlider, config.rb, config.rb);

        // Update values
        this.r1 = config.r1Default;
        this.r2 = config.r2Default;
        this.rb = config.rb * 2;

        this.updateValueDisplays();
    }

    /**
     * Helper to update slider configuration
     */
    updateSliderConfig(slider, config, defaultValue) {
        if (!slider) return;
        slider.min = config.min;
        slider.max = config.max;
        slider.step = config.step;
        slider.value = defaultValue;
    }

    /**
     * Update UI based on selected transfer type
     */
    updateUIBasedOnTransferType() {
        const rbContainer = document.getElementById('rb-container');
        if (rbContainer) {
            rbContainer.style.display =
                (this.transferType === 'bielliptic' || this.transferType === 'both') ? 'block' : 'none';
        }
    }

    /**
     * Update displayed values for sliders
     */
    updateValueDisplays() {
        const unit = this.currentBody === 'sun' ? 'AU' : 'km';

        if (this.r1Value) this.r1Value.textContent = `${this.r1.toLocaleString()} ${unit}`;
        if (this.r2Value) this.r2Value.textContent = `${this.r2.toLocaleString()} ${unit}`;
        if (this.rbValue) this.rbValue.textContent = `${this.rb.toLocaleString()} ${unit}`;
    }

    /**
     * Calculate the orbital transfer using Python
     */
    async calculateTransfer() {
        console.log('[UIController] calculateTransfer called', {
            currentBody: this.currentBody,
            transferType: this.transferType,
            r1: this.r1,
            r2: this.r2,
            rb: this.rb,
            isReady: pyodideLoader.isReady,
            modulesLoaded: pyodideLoader.areModulesLoaded()
        });

        if (!pyodideLoader.isReady) {
            console.log('[UIController] Pyodide not ready yet, skipping calculation');
            return;
        }

        if (!pyodideLoader.areModulesLoaded()) {
            console.error('[UIController] Modules not loaded! Load errors:', pyodideLoader.getModuleLoadErrors());
            this.showError('Python modules failed to load. Please refresh the page to try again.');
            return;
        }

        try {
            // Set parameters in Python
            pyodideLoader.setGlobal('current_body', this.currentBody);
            pyodideLoader.setGlobal('transfer_type', this.transferType);
            pyodideLoader.setGlobal('r1', this.r1);
            pyodideLoader.setGlobal('r2', this.r2);
            pyodideLoader.setGlobal('rb', this.rb);

            // Run calculation with comprehensive error handling
            const pythonCode = `
import json
import traceback
import sys

try:
    import numpy as np
    from constants import get_central_body, EARTH_RADIUS, SUN_RADIUS, AU_KM
    from orbital_mechanics import hohmann_transfer, bielliptic_transfer
    from visualization import plot_transfer_comparison

    # Get central body parameters
    body = get_central_body(current_body)
    mu = body.mu

    # Convert units if necessary
    if current_body == 'sun':
        # Convert AU to km for calculations
        r1_km = r1 * AU_KM
        r2_km = r2 * AU_KM
        rb_km = rb * AU_KM
        body_radius = SUN_RADIUS
        distance_unit = 'AU'
    else:
        r1_km = r1
        r2_km = r2
        rb_km = rb
        body_radius = EARTH_RADIUS
        distance_unit = 'km'

    # Calculate transfers
    hohmann_result = hohmann_transfer(r1_km, r2_km, mu)

    try:
        bielliptic_result = bielliptic_transfer(r1_km, r2_km, rb_km, mu)
    except ValueError as e:
        bielliptic_result = {'error': str(e)}

    # Generate plot
    plot_base64 = plot_transfer_comparison(
        r1_km, r2_km, rb_km, mu,
        body_radius, body.name,
        distance_unit, transfer_type
    )

    # Format results
    result = {
        'hohmann': {
            'dv1': float(hohmann_result['dv1']),
            'dv2': float(hohmann_result['dv2']),
            'dv_total': float(hohmann_result['dv_total']),
            'tof_hours': float(hohmann_result['tof'] / 3600),
            'tof_days': float(hohmann_result['tof'] / 86400),
        },
        'bielliptic': None,
        'plot': plot_base64,
        'body': body.name,
    }

    if 'error' not in bielliptic_result:
        result['bielliptic'] = {
            'dv1': float(bielliptic_result['dv1']),
            'dv2': float(bielliptic_result['dv2']),
            'dv3': float(bielliptic_result['dv3']),
            'dv_total': float(bielliptic_result['dv_total']),
            'tof_days': float(bielliptic_result['tof'] / 86400),
        }

    # Success - return result as JSON
    json.dumps(result)

except Exception as e:
    # Always return valid JSON, even on error
    error_result = {
        'error': str(e),
        'traceback': traceback.format_exc(),
        'type': type(e).__name__
    }
    json.dumps(error_result)
`;

            const jsonResult = await pyodideLoader.runPython(pythonCode);
            
            // Parse with error handling
            let parsedResult;
            try {
                parsedResult = JSON.parse(jsonResult);
            } catch (parseError) {
                console.error('[UIController] Failed to parse Python result as JSON:', parseError);
                console.error('[UIController] Raw result:', jsonResult);
                this.showError(`Failed to parse calculation results: ${parseError.message}. Raw output: ${jsonResult.substring(0, 500)}`);
                return;
            }

            // Check for error in result
            if (parsedResult.error) {
                console.error('[UIController] Python calculation error:', parsedResult);
                this.showError(`Calculation error: ${parsedResult.error}\n\nTraceback:\n${parsedResult.traceback || 'No traceback available'}`);
                return;
            }

            this.results = parsedResult;
            this.updateResults();
            this.updatePlot();

        } catch (error) {
            console.error('[UIController] Calculation error:', error);
            this.showError(`Calculation failed: ${error.message}`);
        }
    }

    /**
     * Update the results display
     */
    updateResults() {
        if (!this.results) return;

        const h = this.results.hohmann;
        const b = this.results.bielliptic;

        // Update displays
        if (this.dv1Display) this.dv1Display.textContent = `${h.dv1.toFixed(2)} km/s`;
        if (this.dv2Display) this.dv2Display.textContent = `${h.dv2.toFixed(2)} km/s`;

        if (this.dv3Display) {
            if (b) {
                this.dv3Display.textContent = `${b.dv3.toFixed(2)} km/s`;
                this.dv3Display.parentElement.style.display = 'flex';
            } else {
                this.dv3Display.parentElement.style.display = 'none';
            }
        }

        if (this.dvTotalDisplay) {
            const totalDv = b && this.transferType === 'bielliptic' ? b.dv_total : h.dv_total;
            this.dvTotalDisplay.textContent = `${totalDv.toFixed(2)} km/s`;
        }

        if (this.tofDisplay) {
            const tofDays = b && this.transferType === 'bielliptic' ? b.tof_days : h.tof_days;
            this.tofDisplay.textContent = `${tofDays.toFixed(1)} days`;
        }

        // Update info panel with comparison
        this.updateInfoPanel();
    }

    /**
     * Update the information panel with educational content
     */
    updateInfoPanel() {
        if (!this.infoPanel || !this.results) return;

        const h = this.results.hohmann;
        const b = this.results.bielliptic;

        let html = `
            <h4>Mission Parameters</h4>
            <p><strong>Central Body:</strong> ${this.results.body}</p>
            <p><strong>Initial Orbit:</strong> ${this.r1.toLocaleString()} ${this.currentBody === 'sun' ? 'AU' : 'km'}</p>
            <p><strong>Final Orbit:</strong> ${this.r2.toLocaleString()} ${this.currentBody === 'sun' ? 'AU' : 'km'}</p>
        `;

        if (this.transferType === 'hohmann' || this.transferType === 'both') {
            html += `
                <h4>Hohmann Transfer</h4>
                <p>The Hohmann transfer is the most fuel-efficient two-impulse transfer between coplanar circular orbits.</p>
                <p>Δv₁ (departure): <strong>${h.dv1.toFixed(2)} km/s</strong></p>
                <p>Δv₂ (arrival): <strong>${h.dv2.toFixed(2)} km/s</strong></p>
                <p>Time of flight: <strong>${h.tof_days.toFixed(1)} days</strong></p>
            `;
        }

        if (b && (this.transferType === 'bielliptic' || this.transferType === 'both')) {
            const savings = ((h.dv_total - b.dv_total) / h.dv_total * 100);
            html += `
                <h4>Bi-elliptic Transfer</h4>
                <p>Uses an intermediate apoapsis at ${this.rb.toLocaleString()} ${this.currentBody === 'sun' ? 'AU' : 'km'}</p>
                <p>Δv₁: <strong>${b.dv1.toFixed(2)} km/s</strong></p>
                <p>Δv₂: <strong>${b.dv2.toFixed(2)} km/s</strong></p>
                <p>Δv₃: <strong>${b.dv3.toFixed(2)} km/s</strong></p>
                <p>Total Δv: <strong>${b.dv_total.toFixed(2)} km/s</strong></p>
                <p>Time of flight: <strong>${b.tof_days.toFixed(1)} days</strong></p>
                <p>Fuel ${savings > 0 ? 'savings' : 'penalty'}: <strong style="color: ${savings > 0 ? '#00ff88' : '#ff6b6b'}">${Math.abs(savings).toFixed(1)}%</strong></p>
            `;

            if (savings > 0) {
                html += `<p class="tip">💡 Bi-elliptic is more efficient for this transfer!</p>`;
            } else {
                html += `<p class="tip">💡 Hohmann is more efficient for this transfer ratio.</p>`;
            }
        }

        // Add mathematical background
        html += `
            <h4>Mathematical Background</h4>
            <p>The vis-viva equation governs orbital velocity:</p>
            <p class="equation">v = √[μ(2/r - 1/a)]</p>
            <p>where μ is the gravitational parameter, r is the current radius, and a is the semi-major axis.</p>
            <p>For a Hohmann transfer between orbits r₁ and r₂, the transfer orbit has semi-major axis a = (r₁ + r₂)/2.</p>
        `;

        this.infoPanel.innerHTML = html;
    }

    /**
     * Update the orbit plot
     */
    updatePlot() {
        if (!this.results || !this.results.plot) return;

        if (this.plotPlaceholder) {
            this.plotPlaceholder.style.display = 'none';
        }

        if (this.plotCanvas) {
            const img = new Image();
            img.onload = () => {
                this.plotCanvas.width = img.width;
                this.plotCanvas.height = img.height;
                const ctx = this.plotCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                this.plotCanvas.style.display = 'block';
            };
            img.src = `data:image/png;base64,${this.results.plot}`;
        }
    }

    /**
     * Show an error message
     */
    showError(message) {
        if (this.infoPanel) {
            this.infoPanel.innerHTML = `<div class="error">${message}</div>`;
        }
        console.error(message);
    }
}

// Export singleton
export const uiController = new UIController();
export default uiController;
