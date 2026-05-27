from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import init_database
from app.routes.ai_runs import router as ai_runs_router
from app.routes.charts import router as charts_router
from app.routes.datasets import router as datasets_router
from app.routes.chart_codes import router as chart_codes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield

app = FastAPI(lifespan=lifespan)

origins =[
    "http://localhost:5173", 
    "http://127.0.0.1:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets_router)
app.include_router(charts_router)
app.include_router(ai_runs_router)
app.include_router(chart_codes_router)