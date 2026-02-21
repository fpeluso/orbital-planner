"""
Core orbital mechanics calculations.
Includes two-body dynamics, transfer orbits, and vis-viva equation.
"""

import numpy as np
from constants import EARTH, SUN, AU_KM


def vis_viva(r, a, mu):
    """
    Calculate orbital velocity using the vis-viva equation.

    v = sqrt(μ * (2/r - 1/a))

    Args:
        r: Current radius (distance from central body)
        a: Semi-major axis of the orbit
        mu: Gravitational parameter

    Returns:
        Velocity magnitude
    """
    return np.sqrt(mu * (2.0 / r - 1.0 / a))


def circular_velocity(r, mu):
    """Velocity of a circular orbit at radius r."""
    return np.sqrt(mu / r)


def orbital_period(a, mu):
    """Calculate orbital period using Kepler's third law."""
    return 2 * np.pi * np.sqrt(a**3 / mu)


def hohmann_transfer(r1, r2, mu):
    """
    Calculate Hohmann transfer between two circular orbits.

    The Hohmann transfer is the most fuel-efficient two-impulse transfer
    between coplanar circular orbits.

    Args:
        r1: Initial circular orbit radius
        r2: Final circular orbit radius
        mu: Gravitational parameter

    Returns:
        dict with:
            - dv1: First burn magnitude (at periapsis)
            - dv2: Second burn magnitude (at apoapsis)
            - dv_total: Total delta-v budget
            - tof: Time of flight (half transfer orbit period)
            - a_transfer: Semi-major axis of transfer orbit
            - e_transfer: Eccentricity of transfer orbit
    """
    # Ensure r1 is the smaller radius
    if r1 > r2:
        r1, r2 = r2, r1

    # Velocities in circular orbits
    v1 = circular_velocity(r1, mu)
    v2 = circular_velocity(r2, mu)

    # Transfer orbit parameters
    a_transfer = (r1 + r2) / 2.0
    e_transfer = (r2 - r1) / (r2 + r1)

    # Velocities at periapsis and apoapsis of transfer orbit
    v_periapsis = vis_viva(r1, a_transfer, mu)
    v_apoapsis = vis_viva(r2, a_transfer, mu)

    # Delta-v calculations
    dv1 = abs(v_periapsis - v1)  # First burn at periapsis
    dv2 = abs(v2 - v_apoapsis)   # Second burn at apoapsis
    dv_total = dv1 + dv2

    # Time of flight (half period of transfer orbit)
    tof = np.pi * np.sqrt(a_transfer**3 / mu)

    return {
        'dv1': dv1,
        'dv2': dv2,
        'dv_total': dv_total,
        'tof': tof,
        'a_transfer': a_transfer,
        'e_transfer': e_transfer,
        'v_periapsis': v_periapsis,
        'v_apoapsis': v_apoapsis,
        'v1_circular': v1,
        'v2_circular': v2,
    }


def bielliptic_transfer(r1, r2, rb, mu):
    """
    Calculate bi-elliptic transfer between two circular orbits.

    The bi-elliptic transfer uses three burns and can be more efficient
    than Hohmann when r2/r1 > 11.94.

    Args:
        r1: Initial circular orbit radius
        r2: Final circular orbit radius
        rb: Intermediate apoapsis radius (must be > max(r1, r2))
        mu: Gravitational parameter

    Returns:
        dict with delta-v values, time of flight, and orbit parameters
    """
    # Ensure r1 < r2 for consistent calculation
    swapped = False
    if r1 > r2:
        r1, r2 = r2, r1
        swapped = True

    if rb <= r2:
        raise ValueError(f"Intermediate radius rb ({rb}) must be > r2 ({r2})")

    # Circular orbit velocities
    v1 = circular_velocity(r1, mu)
    v2 = circular_velocity(r2, mu)

    # First transfer orbit (r1 to rb)
    a1 = (r1 + rb) / 2.0
    v1_peri = vis_viva(r1, a1, mu)
    v1_apo = vis_viva(rb, a1, mu)

    # Second transfer orbit (rb to r2)
    a2 = (r2 + rb) / 2.0
    v2_apo = vis_viva(rb, a2, mu)
    v2_peri = vis_viva(r2, a2, mu)

    # Delta-v calculations
    dv1 = abs(v1_peri - v1)      # First burn at r1
    dv2 = abs(v2_apo - v1_apo)   # Second burn at rb
    dv3 = abs(v2 - v2_peri)      # Third burn at r2
    dv_total = dv1 + dv2 + dv3

    # Time of flight (sum of half periods)
    tof1 = np.pi * np.sqrt(a1**3 / mu)
    tof2 = np.pi * np.sqrt(a2**3 / mu)
    tof = tof1 + tof2

    result = {
        'dv1': dv1,
        'dv2': dv2,
        'dv3': dv3,
        'dv_total': dv_total,
        'tof': tof,
        'tof1': tof1,
        'tof2': tof2,
        'a_transfer1': a1,
        'a_transfer2': a2,
        'e_transfer1': (rb - r1) / (rb + r1),
        'e_transfer2': (rb - r2) / (rb + r2),
    }

    return result


def two_body_dynamics(state, mu):
    """
    Compute derivatives for the two-body problem.

    The two-body equation of motion:
    r̈ = -μ/|r|³ * r

    Args:
        state: Array [x, y, z, vx, vy, vz] in km and km/s
        mu: Gravitational parameter

    Returns:
        Derivatives [vx, vy, vz, ax, ay, az]
    """
    r = state[:3]
    v = state[3:]

    r_norm = np.linalg.norm(r)

    # Acceleration
    a = -mu / (r_norm ** 3) * r

    return np.concatenate([v, a])


def keplerian_to_cartesian(a, e, i, Omega, omega, nu, mu):
    """
    Convert Keplerian orbital elements to Cartesian state vector.

    Args:
        a: Semi-major axis (km)
        e: Eccentricity
        i: Inclination (radians)
        Omega: Right ascension of ascending node (radians)
        omega: Argument of periapsis (radians)
        nu: True anomaly (radians)
        mu: Gravitational parameter

    Returns:
        State vector [x, y, z, vx, vy, vz]
    """
    # Position and velocity in orbital plane
    p = a * (1 - e**2)  # Semi-latus rectum
    r = p / (1 + e * np.cos(nu))

    # Position in orbital plane
    x_orb = r * np.cos(nu)
    y_orb = r * np.sin(nu)

    # Velocity in orbital plane
    vx_orb = -np.sqrt(mu / p) * np.sin(nu)
    vy_orb = np.sqrt(mu / p) * (e + np.cos(nu))

    # Rotation matrix from orbital to inertial frame
    cos_O, sin_O = np.cos(Omega), np.sin(Omega)
    cos_w, sin_w = np.cos(omega), np.sin(omega)
    cos_i, sin_i = np.cos(i), np.sin(i)

    # Transform position
    x = (cos_O * cos_w - sin_O * sin_w * cos_i) * x_orb + (-cos_O * sin_w - sin_O * cos_w * cos_i) * y_orb
    y = (sin_O * cos_w + cos_O * sin_w * cos_i) * x_orb + (-sin_O * sin_w + cos_O * cos_w * cos_i) * y_orb
    z = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb

    # Transform velocity
    vx = (cos_O * cos_w - sin_O * sin_w * cos_i) * vx_orb + (-cos_O * sin_w - sin_O * cos_w * cos_i) * vy_orb
    vy = (sin_O * cos_w + cos_O * sin_w * cos_i) * vx_orb + (-sin_O * sin_w + cos_O * cos_w * cos_i) * vy_orb
    vz = (sin_w * sin_i) * vx_orb + (cos_w * sin_i) * vy_orb

    return np.array([x, y, z, vx, vy, vz])


def calculate_transfer_trajectory(r1, r2, mu, num_points=500):
    """
    Calculate points along a Hohmann transfer orbit.

    Args:
        r1: Initial orbit radius
        r2: Final orbit radius
        mu: Gravitational parameter
        num_points: Number of points to generate

    Returns:
        Array of [x, y] positions along the transfer orbit
    """
    # Ensure r1 < r2
    if r1 > r2:
        r1, r2 = r2, r1

    a = (r1 + r2) / 2.0
    e = (r2 - r1) / (r2 + r1)

    # Generate true anomalies from 0 to π
    nu_values = np.linspace(0, np.pi, num_points)

    # Semi-latus rectum
    p = a * (1 - e**2)

    # Calculate positions
    positions = []
    for nu in nu_values:
        r = p / (1 + e * np.cos(nu))
        x = r * np.cos(nu)
        y = r * np.sin(nu)
        positions.append([x, y])

    return np.array(positions)


def specific_orbital_energy(r, v, mu):
    """Calculate specific orbital energy: ε = v²/2 - μ/r"""
    return 0.5 * np.dot(v, v) - mu / np.linalg.norm(r)


def specific_angular_momentum(state):
    """Calculate specific angular momentum vector: h = r × v"""
    r = state[:3]
    v = state[3:]
    return np.cross(r, v)
