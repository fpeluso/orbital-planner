"""
Physical constants for orbital mechanics calculations.
Supports Earth-centered and Sun-centered scenarios.
"""

import numpy as np

# Earth parameters
EARTH_MU = 398600.4418  # km^3/s^2 (standard gravitational parameter)
EARTH_RADIUS = 6371.0  # km (mean radius)
EARTH_SOI = 0.929e6  # km (Sphere of Influence, approximate)

# Sun parameters
SUN_MU = 1.32712440018e11  # km^3/s^2
SUN_RADIUS = 696340.0  # km
AU_KM = 149597870.7  # km (1 Astronomical Unit)

# Time conversions
SECONDS_PER_DAY = 86400.0
SECONDS_PER_YEAR = 365.25 * SECONDS_PER_DAY

# Common orbital radii (km)
EARTH_LEO_ALTITUDE = 200.0  # km
EARTH_GEO_ALTITUDE = 35786.0  # km
EARTH_LEO_RADIUS = EARTH_RADIUS + EARTH_LEO_ALTITUDE
EARTH_GEO_RADIUS = EARTH_RADIUS + EARTH_GEO_ALTITUDE

# Solar system reference radii (AU)
EARTH_ORBIT_RADIUS = 1.0  # AU
MARS_ORBIT_RADIUS = 1.524  # AU
JUPITER_ORBIT_RADIUS = 5.204  # AU


class CentralBody:
    """Represents a central body for orbital calculations."""

    def __init__(self, name, mu, radius, distance_unit='km', time_unit='s'):
        self.name = name
        self.mu = mu
        self.radius = radius
        self.distance_unit = distance_unit
        self.time_unit = time_unit

    def __repr__(self):
        return f"CentralBody({self.name}, μ={self.mu:.4e} {self.distance_unit}³/{self.time_unit}²)"


# Predefined central bodies
EARTH = CentralBody(
    name='Earth',
    mu=EARTH_MU,
    radius=EARTH_RADIUS,
    distance_unit='km',
    time_unit='s'
)

SUN = CentralBody(
    name='Sun',
    mu=SUN_MU,
    radius=SUN_RADIUS,
    distance_unit='km',
    time_unit='s'
)

SUN_AU = CentralBody(
    name='Sun (AU units)',
    mu=4 * np.pi**2,  # AU^3/year^2
    radius=SUN_RADIUS / AU_KM,  # AU
    distance_unit='AU',
    time_unit='year'
)


def get_central_body(name):
    """Get a central body by name."""
    bodies = {
        'earth': EARTH,
        'sun': SUN,
        'sun_au': SUN_AU,
    }
    return bodies.get(name.lower(), EARTH)
