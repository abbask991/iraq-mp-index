"""Corporate Intelligence suite API."""
from fastapi import APIRouter

from app.services import cache, corporate_intel

router = APIRouter(prefix="/api/corporate", tags=["corporate"])


@router.get("/reputation")
async def reputation(brand: str = "", demo: int = 0):
    if demo:
        return await cache.swr("corp:rep:demo", 86400, lambda: corporate_intel.brand_reputation(brand, demo=True))
    return await cache.swr(f"corp:rep:{brand}", 3600, lambda: corporate_intel.brand_reputation(brand))


@router.get("/complaints")
async def complaints(brand: str = "", demo: int = 0):
    if demo:
        return await cache.swr("corp:comp:demo", 86400, lambda: corporate_intel.complaints(brand, demo=True))
    return await cache.swr(f"corp:comp:{brand}", 3600, lambda: corporate_intel.complaints(brand))


@router.get("/competitors")
async def competitors(brand: str = "", demo: int = 0):
    if demo:
        return await cache.swr("corp:cmp:demo", 86400, lambda: corporate_intel.competitors(brand, demo=True))
    return await corporate_intel.competitors(brand)


@router.get("/fraud")
async def fraud(brand: str = "", demo: int = 0):
    if demo:
        return await cache.swr("corp:fraud:demo", 86400, lambda: corporate_intel.fraud_pages(brand, demo=True))
    return await corporate_intel.fraud_pages(brand)


@router.get("/risk-index")
async def risk_index(brand: str = "", demo: int = 0):
    if demo:
        return await cache.swr("corp:risk:demo", 86400, lambda: corporate_intel.risk_index(brand, demo=True))
    return await corporate_intel.risk_index(brand)
