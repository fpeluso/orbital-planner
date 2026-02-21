"""
Visualization functions for orbital mechanics using matplotlib.
Designed to work with Pyodide in the browser.
"""

import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for Pyodide
import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyArrowPatch
import io
import base64


def create_orbit_plot(width=10, height=8, dpi=100):
    """Create a new figure with dark theme styling."""
    plt.style.use('dark_background')
    fig, ax = plt.subplots(figsize=(width, height), dpi=dpi)
    ax.set_facecolor('#0a0e14')
    fig.patch.set_facecolor('#0a0e14')
    ax.set_aspect('equal')
    return fig, ax


def plot_central_body(ax, radius, color='#1e3a5f', label=None):
    """Plot the central body (Earth, Sun, etc.) as a filled circle."""
    body = Circle((0, 0), radius, color=color, zorder=10)
    ax.add_patch(body)

    # Add a glow effect
    glow = Circle((0, 0), radius * 1.1, color=color, alpha=0.3, zorder=9)
    ax.add_patch(glow)

    if label:
        ax.annotate(label, (0, 0), ha='center', va='center',
                   fontsize=10, fontweight='bold', color='white')


def plot_orbit_trajectory(ax, positions, color='#00ff88', linewidth=2, label=None, alpha=0.8):
    """Plot an orbital trajectory from position array."""
    if len(positions.shape) == 2 and positions.shape[1] >= 2:
        ax.plot(positions[:, 0], positions[:, 1], color=color,
                linewidth=linewidth, alpha=alpha, label=label)
    else:
        ax.plot(positions[0], positions[1], color=color,
                linewidth=linewidth, alpha=alpha, label=label)


def plot_circular_orbit(ax, radius, color='#444466', linewidth=1.5, linestyle='--', label=None):
    """Plot a reference circular orbit."""
    theta = np.linspace(0, 2*np.pi, 200)
    x = radius * np.cos(theta)
    y = radius * np.sin(theta)
    ax.plot(x, y, color=color, linewidth=linewidth, linestyle=linestyle,
            alpha=0.6, label=label)


def plot_burn_points(ax, burn_positions, burn_magnitudes=None, scale=1.0):
    """Mark burn locations with arrows or markers."""
    colors = ['#ff6b6b', '#ffd93d', '#6bcf7f']

    for i, pos in enumerate(burn_positions):
        color = colors[i % len(colors)]
        ax.scatter(pos[0], pos[1], s=150, c=color, marker='*',
                  edgecolors='white', linewidths=1.5, zorder=15)

        if burn_magnitudes and i < len(burn_magnitudes):
            ax.annotate(f'Δv={burn_magnitudes[i]:.2f}',
                       (pos[0], pos[1]),
                       xytext=(10, 10), textcoords='offset points',
                       fontsize=9, color=color,
                       bbox=dict(boxstyle='round,pad=0.3', facecolor='#1a1f2e', edgecolor=color))


def plot_transfer_comparison(r1, r2, rb, mu, body_radius, body_name='Earth',
                             distance_unit='km', transfer_type='both'):
    """
    Create a comprehensive transfer comparison plot.

    Args:
        r1: Initial orbit radius
        r2: Final orbit radius
        rb: Bi-elliptic intermediate radius (for bi-elliptic)
        mu: Gravitational parameter
        body_radius: Radius of central body for visualization
        body_name: Name of central body
        distance_unit: Unit for distances ('km' or 'AU')
        transfer_type: 'hohmann', 'bielliptic', or 'both'

    Returns:
        Base64-encoded PNG image string
    """
    from orbital_mechanics import hohmann_transfer, bielliptic_transfer, calculate_transfer_trajectory

    fig, ax = create_orbit_plot(width=12, height=10, dpi=120)

    # Plot central body
    plot_central_body(ax, body_radius, label=body_name)

    # Plot initial and final orbits
    plot_circular_orbit(ax, r1, color='#4a9eff', linewidth=2, label=f'Initial Orbit (r={r1:.0f})')
    plot_circular_orbit(ax, r2, color='#ff6b6b', linewidth=2, label=f'Final Orbit (r={r2:.0f})')

    # Calculate and plot transfers
    if transfer_type in ('hohmann', 'both'):
        hohmann = hohmann_transfer(r1, r2, mu)
        hohmann_traj = calculate_transfer_trajectory(r1, r2, mu, num_points=200)
        plot_orbit_trajectory(ax, hohmann_traj, color='#00ff88', linewidth=2.5,
                             label=f"Hohmann (Δv={hohmann['dv_total']:.2f})")

        # Mark burn points
        burn_pos = [[r1, 0], [-r2, 0]]
        burn_mag = [hohmann['dv1'], hohmann['dv2']]
        plot_burn_points(ax, burn_pos, burn_mag)

    if transfer_type in ('bielliptic', 'both'):
        try:
            biell = bielliptic_transfer(r1, r2, rb, mu)

            # First leg
            traj1 = calculate_transfer_trajectory(r1, rb, mu, num_points=100)
            plot_orbit_trajectory(ax, traj1, color='#ffd93d', linewidth=2,
                                 label=f"Bi-elliptic leg 1")

            # Second leg (need to reverse direction)
            traj2 = calculate_transfer_trajectory(r2, rb, mu, num_points=100)
            traj2[:, 0] = -traj2[:, 0]  # Mirror for correct orientation
            plot_orbit_trajectory(ax, traj2, color='#ffd93d', linewidth=2,
                                 label=f"Bi-elliptic leg 2")

            burn_pos = [[r1, 0], [0, rb], [-r2, 0]]
            burn_mag = [biell['dv1'], biell['dv2'], biell['dv3']]
            plot_burn_points(ax, burn_pos, burn_mag)
        except ValueError as e:
            ax.text(0.5, 0.95, f"Bi-elliptic: {e}", transform=ax.transAxes,
                   ha='center', va='top', fontsize=10, color='red')

    # Set axis limits
    max_r = max(r1, r2, rb if transfer_type in ('bielliptic', 'both') else 0) * 1.2
    ax.set_xlim(-max_r, max_r)
    ax.set_ylim(-max_r, max_r)

    # Labels and title
    ax.set_xlabel(f'X ({distance_unit})', fontsize=12, color='#cccccc')
    ax.set_ylabel(f'Y ({distance_unit})', fontsize=12, color='#cccccc')
    ax.set_title(f'Orbital Transfer: {body_name}\n' +
                f'r₁={r1:.0f} → r₂={r2:.0f} {distance_unit}',
                fontsize=14, fontweight='bold', color='#00ff88', pad=20)

    ax.legend(loc='upper right', fontsize=9, facecolor='#1a1f2e',
             edgecolor='#444466', labelcolor='#cccccc')
    ax.grid(True, alpha=0.2, color='#444466')
    ax.tick_params(colors='#cccccc')

    plt.tight_layout()

    # Save to base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', facecolor='#0a0e14', edgecolor='none')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()

    return img_base64


def plot_propagated_trajectory(propagation_result, body_radius, body_name='Earth',
                               distance_unit='km'):
    """
    Plot a numerically propagated trajectory.

    Args:
        propagation_result: Result from propagate_trajectory()
        body_radius: Central body radius
        body_name: Name of central body
        distance_unit: Unit string

    Returns:
        Base64-encoded PNG image string
    """
    fig, ax = create_orbit_plot(width=10, height=10, dpi=120)

    states = propagation_result['y']
    positions = states[:, :2]  # x, y coordinates

    # Plot central body
    plot_central_body(ax, body_radius, label=body_name)

    # Plot trajectory with gradient color
    scatter = ax.scatter(positions[:, 0], positions[:, 1],
                        c=propagation_result['t'],
                        cmap='viridis', s=5, alpha=0.7)

    # Add colorbar for time
    cbar = plt.colorbar(scatter, ax=ax, shrink=0.6)
    cbar.set_label(f'Time ({distance_unit})', color='#cccccc')
    cbar.ax.tick_params(colors='#cccccc')

    # Set axis limits
    max_pos = np.max(np.abs(positions)) * 1.2
    ax.set_xlim(-max_pos, max_pos)
    ax.set_ylim(-max_pos, max_pos)

    ax.set_xlabel(f'X ({distance_unit})', fontsize=12, color='#cccccc')
    ax.set_ylabel(f'Y ({distance_unit})', fontsize=12, color='#cccccc')
    ax.set_title(f'Propagated Trajectory - {body_name}',
                fontsize=14, fontweight='bold', color='#00ff88', pad=20)
    ax.grid(True, alpha=0.2, color='#444466')
    ax.tick_params(colors='#cccccc')

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', facecolor='#0a0e14', edgecolor='none')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()

    return img_base64


def create_delta_v_comparison_plot(r1, r2_values, mu):
    """
    Create a plot comparing Hohmann vs Bi-elliptic delta-v requirements.

    Args:
        r1: Fixed initial radius
        r2_values: Array of final radii to evaluate
        mu: Gravitational parameter

    Returns:
        Base64-encoded PNG image string
    """
    from orbital_mechanics import hohmann_transfer, bielliptic_transfer

    fig, ax = create_orbit_plot(width=10, height=6, dpi=120)

    hohmann_dv = []
    bielliptic_dv = []
    ratios = r2_values / r1

    for r2 in r2_values:
        h = hohmann_transfer(r1, r2, mu)
        hohmann_dv.append(h['dv_total'])

        # Bi-elliptic with rb = 2*r2 (arbitrary choice for comparison)
        rb = 2 * r2
        try:
            b = bielliptic_transfer(r1, r2, rb, mu)
            bielliptic_dv.append(b['dv_total'])
        except ValueError:
            bielliptic_dv.append(np.nan)

    ax.plot(ratios, hohmann_dv, 'g-', linewidth=2.5, label='Hohmann')
    ax.plot(ratios, bielliptic_dv, 'y-', linewidth=2, label='Bi-elliptic (r_b=2r₂)')

    # Mark the transition point (r2/r1 ≈ 11.94)
    ax.axvline(x=11.94, color='r', linestyle='--', alpha=0.5,
              label='Transition (r₂/r₁ = 11.94)')

    ax.set_xlabel('Orbit Radius Ratio (r₂/r₁)', fontsize=12, color='#cccccc')
    ax.set_ylabel('Total Δv (km/s)', fontsize=12, color='#cccccc')
    ax.set_title('Transfer Efficiency Comparison',
                fontsize=14, fontweight='bold', color='#00ff88', pad=20)
    ax.legend(loc='upper right', fontsize=10, facecolor='#1a1f2e',
             edgecolor='#444466', labelcolor='#cccccc')
    ax.grid(True, alpha=0.2, color='#444466')
    ax.tick_params(colors='#cccccc')

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', facecolor='#0a0e14', edgecolor='none')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()

    return img_base64


def plot_to_canvas_code():
    """
    Return JavaScript code to render matplotlib figure to HTML canvas.
    This is a template for Pyodide integration.
    """
    return """
    // This function will be called from JavaScript to render the plot
    function renderPlotToCanvas(base64Image, canvasId) {
        const canvas = document.getElementById(canvasId);
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = 'data:image/png;base64,' + base64Image;
    }
    """
