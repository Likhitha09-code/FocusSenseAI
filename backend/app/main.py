from fastapi import FastAPI

from app.api.routes import api_router

app = FastAPI(
    title="FocusSense AI API",
    description="API foundation for study behaviour analysis and measured interventions.",
    version="0.1.0",
)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "focussense-api"}


app.include_router(api_router)