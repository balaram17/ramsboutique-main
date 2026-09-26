# CORS fix for Azure Static Web Apps

The storefront at `https://gray-ground-094425710.7.azurestaticapps.net` is blocked because `backend/server.py` only allows `ramsboutique.com` and localhost.

## Change in `backend/server.py`

Replace the current CORS block:

```python
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://www.ramsboutique.com",
    "https://ramsboutique.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

with:

```python
from cors_setup import apply_cors
apply_cors(app)
```

Then redeploy the API App Service (`ramsboutique-api-prod`).

## Immediate workaround (no code deploy)

Azure Portal → App Service `ramsboutique-api-prod` → API → CORS → add:

`https://gray-ground-094425710.7.azurestaticapps.net`

Also add your custom domain when you attach it.
