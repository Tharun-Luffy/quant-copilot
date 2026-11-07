"""Application configuration settings for Quant Copilot backend."""

from __future__ import annotations

import os
from typing import Optional
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Core settings loaded from environment variables."""

    # Database (PostgreSQL + pgvector)
    DATABASE_URL: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/quant_copilot",
        )
    )
    DATABASE_URL_ASYNC: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL_ASYNC",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/quant_copilot",
        )
    )

    # Redis Cache & State Store
    REDIS_URL: str = Field(
        default_factory=lambda: os.getenv(
            "REDIS_URL",
            "redis://localhost:6379/0",
        )
    )

    # LLM Settings
    OPENAI_API_KEY: Optional[str] = Field(
        default_factory=lambda: os.getenv("OPENAI_API_KEY")
    )
    LLM_MODEL: str = Field(
        default_factory=lambda: os.getenv("LLM_MODEL", "gpt-4o")
    )

    # Indian Market Conventions (SYSTEM_SPEC.md)
    NSE_TRADING_DAYS: int = 252
    DEFAULT_RBI_GSEC_RATE: float = 0.068  # 6.8% 10-Year G-Sec yield


settings = Settings()
