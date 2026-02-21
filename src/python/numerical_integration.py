"""
Numerical integration methods for orbital propagation.
Includes RK4 (4th-order Runge-Kutta) and adaptive step size support.
"""

import numpy as np
from orbital_mechanics import two_body_dynamics


def rk4_step(f, y, t, dt, *args):
    """
    Single step of 4th-order Runge-Kutta integration.

    For dy/dt = f(t, y), computes y(t + dt) using:
    k1 = f(t, y)
    k2 = f(t + dt/2, y + dt*k1/2)
    k3 = f(t + dt/2, y + dt*k2/2)
    k4 = f(t + dt, y + dt*k3)
    y_new = y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)

    Args:
        f: Function dy/dt = f(t, y, *args)
        y: Current state vector
        t: Current time
        dt: Time step
        *args: Additional arguments for f

    Returns:
        New state vector at t + dt
    """
    k1 = f(t, y, *args)
    k2 = f(t + dt/2, y + dt*k1/2, *args)
    k3 = f(t + dt/2, y + dt*k2/2, *args)
    k4 = f(t + dt, y + dt*k3, *args)

    return y + dt/6 * (k1 + 2*k2 + 2*k3 + k4)


def propagate_trajectory(dynamics_func, y0, t_span, dt, mu, method='rk4'):
    """
    Propagate a trajectory using numerical integration.

    Args:
        dynamics_func: Function computing dy/dt (e.g., two_body_dynamics)
        y0: Initial state vector [x, y, z, vx, vy, vz]
        t_span: (t_start, t_end) time interval
        dt: Time step size
        mu: Gravitational parameter (passed to dynamics_func)
        method: Integration method ('rk4' supported)

    Returns:
        dict with:
            - t: Time array
            - y: State vectors at each time step
            - num_steps: Number of integration steps
    """
    t_start, t_end = t_span

    # Wrapper for dynamics function signature
    def f(t, y, mu_param):
        return dynamics_func(y, mu_param)

    times = [t_start]
    states = [np.array(y0)]

    t = t_start
    y = np.array(y0)
    num_steps = 0

    while t < t_end:
        # Adjust final step to land exactly on t_end
        current_dt = min(dt, t_end - t)

        if method == 'rk4':
            y = rk4_step(f, y, t, current_dt, mu)
        else:
            raise ValueError(f"Unknown integration method: {method}")

        t += current_dt
        num_steps += 1

        times.append(t)
        states.append(y.copy())

    return {
        't': np.array(times),
        'y': np.array(states),
        'num_steps': num_steps,
    }


def propagate_hohmann_transfer(r1, r2, mu, dt=60.0):
    """
    Propagate a complete Hohmann transfer from r1 to r2.

    Args:
        r1: Initial circular orbit radius
        r2: Final circular orbit radius
        mu: Gravitational parameter
        dt: Integration time step (seconds)

    Returns:
        dict with trajectory data and transfer parameters
    """
    from orbital_mechanics import hohmann_transfer, vis_viva, orbital_period

    # Ensure r1 < r2
    if r1 > r2:
        r1, r2 = r2, r1

    # Get transfer parameters
    transfer = hohmann_transfer(r1, r2, mu)
    tof = transfer['tof']
    a_transfer = transfer['a_transfer']
    e_transfer = transfer['e_transfer']

    # Initial state: at periapsis of transfer orbit
    # Position: (r1, 0, 0)
    # Velocity: (0, v_periapsis, 0)
    v_peri = transfer['v_periapsis']
    y0 = np.array([r1, 0.0, 0.0, 0.0, v_peri, 0.0])

    # Propagate for the transfer time
    result = propagate_trajectory(
        two_body_dynamics,
        y0,
        (0, tof),
        dt,
        mu,
        method='rk4'
    )

    return {
        'trajectory': result,
        'transfer_params': transfer,
        'r1': r1,
        'r2': r2,
        'mu': mu,
    }


def propagate_with_events(dynamics_func, y0, t_span, dt, mu, events=None, max_steps=100000):
    """
    Propagate with event detection.

    Args:
        dynamics_func: Dynamics function
        y0: Initial state
        t_span: Time interval
        dt: Time step
        mu: Gravitational parameter
        events: List of event functions (state -> value, crossing direction)
        max_steps: Maximum number of steps

    Returns:
        dict with trajectory and detected events
    """
    def f(t, y, mu_param):
        return dynamics_func(y, mu_param)

    times = [t_span[0]]
    states = [np.array(y0)]
    event_log = []

    t = t_span[0]
    y = np.array(y0)
    step = 0

    while t < t_span[1] and step < max_steps:
        current_dt = min(dt, t_span[1] - t)

        y_new = rk4_step(f, y, t, current_dt, mu)
        t_new = t + current_dt

        # Check for events
        if events:
            for event_func, direction, name in events:
                val_old = event_func(y)
                val_new = event_func(y_new)

                # Check for zero crossing
                if val_old * val_new < 0:  # Sign change
                    if direction == 0 or (direction > 0 and val_new > val_old) or (direction < 0 and val_new < val_old):
                        event_log.append({
                            'time': t_new,
                            'state': y_new.copy(),
                            'event': name,
                        })

        t = t_new
        y = y_new
        step += 1

        times.append(t)
        states.append(y.copy())

    return {
        't': np.array(times),
        'y': np.array(states),
        'events': event_log,
        'num_steps': step,
    }


def energy_conservation_check(states, mu):
    """
    Check energy conservation along a trajectory.

    Args:
        states: Array of state vectors [N, 6]
        mu: Gravitational parameter

    Returns:
        Array of specific orbital energies
    """
    energies = []
    for state in states:
        r = state[:3]
        v = state[3:]
        r_norm = np.linalg.norm(r)
        v_norm = np.linalg.norm(v)
        energy = 0.5 * v_norm**2 - mu / r_norm
        energies.append(energy)

    return np.array(energies)


def circular_orbit_state(r, mu, inclination=0.0):
    """
    Generate initial state for a circular orbit.

    Args:
        r: Orbit radius
        mu: Gravitational parameter
        inclination: Orbit inclination (radians, default 0)

    Returns:
        State vector [x, y, z, vx, vy, vz]
    """
    v = np.sqrt(mu / r)

    # Position at (r, 0, 0)
    x = r
    y = 0.0
    z = 0.0

    # Velocity perpendicular in y-direction (with inclination)
    vx = 0.0
    vy = v * np.cos(inclination)
    vz = v * np.sin(inclination)

    return np.array([x, y, z, vx, vy, vz])
