import asyncio
from contextlib import asynccontextmanager
import logging
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.config import settings
from app.db import engine
from app.push_worker import tick as push_tick
from app.routes import auth, residents, billing, visitors, complaints, amenities, community, home, guard, admin, setup, emergencies, finance, resources, operations, platform, refunds


async def push_worker_loop():
    """Background task running push notification delivery every 5 seconds."""
    while True:
        try:
            await asyncio.to_thread(push_tick)
        except asyncio.CancelledError:
            break
        except Exception:
            logging.exception("Push worker loop iteration failed")
        try:
            await asyncio.sleep(5)
        except asyncio.CancelledError:
            break


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker_task = None
    if os.getenv("ENABLE_PUSH_WORKER", "true").lower() in ("true", "1", "yes"):
        logging.info("Starting embedded push notification worker loop...")
        worker_task = asyncio.create_task(push_worker_loop())
    try:
        yield
    finally:
        if worker_task:
            logging.info("Stopping embedded push notification worker loop...")
            worker_task.cancel()
            try:
                await worker_task
            except asyncio.CancelledError:
                pass


app = FastAPI(
    title="Society Resident API",
    version="1.0.0",
    docs_url="/docs" if settings().app_env == "development" else None,
    redoc_url=None,
    lifespan=lifespan,
)
app.add_middleware(CORSMiddleware, allow_origins=settings().cors_origins, allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"], allow_headers=["Authorization", "Content-Type", "X-Property-Id"])
for module in (auth, residents, billing, visitors, complaints, amenities, community, home, guard, admin, setup, emergencies, finance, resources, operations, platform, refunds):
    app.include_router(module.router)



@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return JSONResponse({"error": {"message": exc.detail}}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return JSONResponse({"error": {"message": "Please check the information you entered.", "fields": [{"field": ".".join(str(i) for i in e["loc"][1:]), "message": e["msg"]} for e in exc.errors()]}}, status_code=422)


@app.exception_handler(IntegrityError)
async def conflict_error(request, exc):
    return JSONResponse({"error": {"message": "This record already exists or conflicts with another update."}}, status_code=409)


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logging.exception("Unexpected request failure", exc_info=exc)
    return JSONResponse({"error": {"message": "Something went wrong. Please try again shortly."}}, status_code=500)


@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ok", "environment": settings().app_env}
