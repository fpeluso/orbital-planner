# 🚀 Orbital Transfer Planner

An interactive, browser-based space mission design tool for calculating and visualizing orbital transfers. Powered by Python running in the browser via [Pyodide](https://pyodide.org/) and WebAssembly.

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Live-brightgreen?style=flat-square&logo=github)](https://fpeluso.github.io/orbital-planner/)
[![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)](https://www.python.org/)
[![Pyodide](https://img.shields.io/badge/Powered%20by-Pyodide-orange?style=flat-square)](https://pyodide.org/)

![Orbital Transfer Visualization](docs/screenshot.png)

## 🌟 Features

- **Hohmann Transfer Calculator**: The most fuel-efficient two-impulse transfer between coplanar circular orbits
- **Bi-elliptic Transfer Calculator**: Three-burn transfer that can be more efficient for large radius ratios (r₂/r₁ > 11.94)
- **RK4 Numerical Integration**: 4th-order Runge-Kutta propagation of the two-body ODE
- **Switchable Central Bodies**: Calculate transfers around Earth or the Sun
- **Real-time Matplotlib Visualization**: Orbit plots rendered directly in the browser
- **Educational Tooltips**: Learn about orbital mechanics as you design missions

## 🎯 Quick Start

Visit the live demo: **[fpeluso.github.io/orbital-planner](https://fpeluso.github.io/orbital-planner/)**

### Preset Missions

| Mission | Transfer Type | Parameters |
|---------|---------------|------------|
| LEO → GEO | Hohmann | r₁ ≈ 6,571 km, r₂ ≈ 42,164 km |
| LEO → Moon | Hohmann | r₁ ≈ 6,571 km, r₂ ≈ 384,400 km |
| Earth → Mars | Hohmann | r₁ = 1.0 AU, r₂ = 1.524 AU |
| Earth → Jupiter | Compare both | r₁ = 1.0 AU, r₂ = 5.204 AU |

## 📐 Mathematical Foundation

### Two-Body Problem

All orbital propagation uses the fundamental equation of motion:

$$
\ddot{\mathbf{r}} = -\frac{\mu}{|\mathbf{r}|^3} \mathbf{r}
$$

Where:
- **r** is the position vector
- **μ** is the standard gravitational parameter (GM)
- For Earth: μ = 398,600.4418 km³/s²
- For Sun: μ = 1.32712440018 × 10¹¹ km³/s²

### Vis-Viva Equation

Orbital velocity at any point is calculated using:

$$
v = \sqrt{\mu \left(\frac{2}{r} - \frac{1}{a}\right)}
$$

Where:
- **r** is the current orbital radius
- **a** is the semi-major axis of the orbit

### Hohmann Transfer

For a transfer between circular orbits r₁ and r₂:

**Transfer orbit semi-major axis:**
$$
a_t = \frac{r_1 + r_2}{2}
$$

**Delta-v budget:**
$$
\Delta v_{total} = |v_{t,p} - v_1| + |v_2 - v_{t,a}|
$$

Where vₜ,ₚ and vₜ,ₐ are velocities at periapsis and apoapsis of the transfer orbit.

**Time of flight:**
$$
TOF = \pi \sqrt{\frac{a_t^3}{\mu}}
$$

### Bi-elliptic Transfer

For transfers where r₂/r₁ > 11.94, the bi-elliptic transfer uses an intermediate apoapsis r_b:

1. Burn 1: Enter first transfer orbit to r_b
2. Burn 2: At r_b, enter second transfer orbit to r₂
3. Burn 3: Circularize at r₂

### RK4 Integration

Trajectory propagation uses 4th-order Runge-Kutta:

$$
\begin{aligned}
k_1 &= f(t_n, y_n) \\
k_2 &= f(t_n + \frac{h}{2}, y_n + \frac{h}{2}k_1) \\
k_3 &= f(t_n + \frac{h}{2}, y_n + \frac{h}{2}k_2) \\
k_4 &= f(t_n + h, y_n + hk_3) \\
y_{n+1} &= y_n + \frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)
\end{aligned}
$$

## 🏗️ Project Structure

```
orbital-planner/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Pages CI/CD
├── src/
│   ├── index.html              # Main SPA entry point
│   ├── styles/
│   │   └── main.css            # Dark mission-control theme
│   ├── js/
│   │   ├── main.js             # App initialization
│   │   ├── pyodide-loader.js   # Pyodide setup & package loading
│   │   └── ui-controller.js    # UI event handling
│   └── python/
│       ├── constants.py        # Physical constants (Earth, Sun)
│       ├── orbital_mechanics.py    # Core physics & transfers
│       ├── numerical_integration.py # RK4 implementation
│       └── visualization.py    # matplotlib plotting
├── README.md
└── .gitignore
```

## 🚀 Development

### Local Development

Since this is a pure client-side application, you can run it with any static file server:

```bash
# Using Python
python -m http.server 8000 --directory src

# Using Node.js
npx serve src

# Using PHP
php -S localhost:8000 -t src
```

Then open `http://localhost:8000` in your browser.

### How It Works

1. **Pyodide Loading**: The app loads Pyodide runtime (~8MB) from jsDelivr CDN
2. **Package Installation**: NumPy and matplotlib are installed via micropip
3. **Python Module Loading**: Custom orbital mechanics modules are loaded into the Pyodide filesystem
4. **Interactive Calculation**: User inputs trigger Python calculations, results are displayed in real-time
5. **Visualization**: matplotlib generates plots which are rendered as base64 PNGs to an HTML canvas

### Browser Compatibility

- Chrome/Edge 90+
- Firefox 90+
- Safari 15+

Requires WebAssembly support.

## 📝 Key Formulas Reference

| Quantity | Formula | Units |
|----------|---------|-------|
| Circular velocity | v = √(μ/r) | km/s |
| Orbital period | T = 2π√(a³/μ) | s |
| Specific energy | ε = v²/2 - μ/r | km²/s² |
| Hohmann Δv | See above | km/s |
| Bi-elliptic Δv | Sum of 3 burns | km/s |

## 🔬 Physics Validation

### Test Case: LEO to GEO Transfer

**Parameters:**
- r₁ = 6,571 km (200 km altitude)
- r₂ = 42,164 km (GEO)
- μ = 398,600 km³/s²

**Expected Results:**
- Δv₁ ≈ 2.46 km/s
- Δv₂ ≈ 1.47 km/s
- Total Δv ≈ 3.93 km/s
- TOF ≈ 5.26 hours

### Test Case: Earth to Mars

**Parameters:**
- r₁ = 1.0 AU
- r₂ = 1.524 AU

**Expected Results:**
- Total Δv ≈ 5.59 km/s
- TOF ≈ 259 days

## 🎨 Design Philosophy

The UI follows a "mission control" aesthetic inspired by NASA's actual control interfaces:

- **Dark backgrounds** reduce eye strain and emulate CRT monitors
- **Monospace fonts** for data readouts ensure alignment
- **Cyan/green accents** on black mimic phosphor displays
- **Grid-based layout** organizes information hierarchically

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [Pyodide](https://pyodide.org/) - Python in the browser
- [NumPy](https://numpy.org/) - Numerical computing
- [Matplotlib](https://matplotlib.org/) - Visualization
- [Bate, Mueller, White](https://www.amazon.com/Fundamentals-Astrodynamics-Dover-Books-Engineering/dp/0486600610) - Fundamentals of Astrodynamics

---

**Built with 🚀 for space enthusiasts everywhere**
