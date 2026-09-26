"""CORS for the BTA FreshMart API (browser + Azure Static Web Apps)."""
import os

from starlette.middleware.cors import CORSMiddleware

DEFAULT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.ramsboutique.com",
    "https://ramsboutique.com",
    "https://gray-ground-094425710.7.azurestaticapps.net",
]

# Preview and default Azure Static Web Apps hostnames, plus the custom domain.
ORIGIN_REGEX = r"https://([a-z0-9-]+\.)*(azurestaticapps\.net|ramsboutique\.com)"


def cors_origins():
    extra = [
        value.strip().rstrip("/")
        for value in os.environ.get("CORS_ORIGINS", "").split(",")
        if value.strip()
    ]
    seen = set()
    origins = []
    for origin in DEFAULT_ORIGINS + extra:
        if origin and origin not in seen:
            seen.add(origin)
            origins.append(origin)
    return origins


def apply_cors(app):
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_origin_regex=ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
        max_age=86400,
    )
