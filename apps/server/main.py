"""FastAPI Application entrypoint for Quant Copilot backend."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.server.api.chat import router as chat_router

app = FastAPI(
    title="Quant Copilot API",
    description="Quantitative Risk and Corporate Intelligence Engine for Indian Equities (NSE/BSE)",
    version="1.0.0",
)

# Enable CORS for frontend UI connectivity
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(chat_router)


@app.get("/health")
async def health_check() -> dict:
    """Service health status check."""
    return {"status": "ok", "service": "quant-copilot-backend"}
