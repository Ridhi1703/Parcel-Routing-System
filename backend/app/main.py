from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth, parcels, rules, dashboard, batch, users, me

app = FastAPI(title="ParcelFlow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(parcels.router)
app.include_router(batch.router)
app.include_router(rules.router)
app.include_router(dashboard.router)
app.include_router(users.router)
app.include_router(me.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
