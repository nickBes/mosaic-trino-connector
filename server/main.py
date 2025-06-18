from fastapi import FastAPI
from pydantic import BaseModel
import sqlglot
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TranspileReq(BaseModel):
    query: str
    source_dialect: str
    target_dialect: str


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.post("/transpile")
async def transpile(tr: TranspileReq):
    transpiled = sqlglot.transpile(
        tr.query, read=tr.source_dialect, write=tr.target_dialect
    )[0]

    return {"query": transpiled}
