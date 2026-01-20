"""FLux Backend API - Privacy-focused period tracking."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api import routes

app = FastAPI(
    title="FLux API",
    description="Privacy-focused period tracking API",
    version="0.1.0",
)

# Configure CORS - restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(routes.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
