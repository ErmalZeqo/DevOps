from fastapi import FastAPI, Query, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import declarative_base, sessionmaker
import os
import time
import requests
import logging
import json
from datetime import datetime
from pathlib import Path


# =========================
# Configuration générale
# =========================

load_dotenv()

TMDB_TOKEN = os.getenv("TMDB_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")

app = FastAPI(title="NACO Movie API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# Configuration base de données
# =========================

Base = declarative_base()

if DATABASE_URL:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
else:
    engine = None
    SessionLocal = None


class Favorite(Base):
    __tablename__ = "favorites"

    id = Column(Integer, primary_key=True, index=True)
    tmdb_id = Column(Integer, unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    year = Column(String(20), nullable=True)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)


class FavoriteCreate(BaseModel):
    tmdb_id: int
    title: str
    year: str | None = ""
    description: str | None = ""
    image_url: str | None = ""


@app.on_event("startup")
def startup():
    if engine is not None:
        Base.metadata.create_all(bind=engine)


# =========================
# Configuration TMDB
# =========================

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

CACHE = {"ts": 0.0, "data": None}
CACHE_TTL = 60

MOVIES_CACHE: dict[int, dict] = {}
MOVIES_CACHE_TTL = 60

SEARCH_CACHE: dict[str, dict] = {}
SEARCH_CACHE_TTL = 60

TMDB_MAX_RETRIES = 3
TMDB_BACKOFF_BASE_S = 0.8

logger = logging.getLogger("tme3")

if not logger.handlers:
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


# =========================
# Fonctions utilitaires TMDB
# =========================

def tmdb_get(path: str, params: dict | None = None):
    if not TMDB_TOKEN:
        raise HTTPException(
            status_code=401,
            detail="TMDB_TOKEN manquant. Vérifie le fichier .env côté back-end.",
        )

    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}",
        "accept": "application/json",
    }

    url = f"{TMDB_BASE}{path}"

    last_status = None
    last_err = None

    for attempt in range(TMDB_MAX_RETRIES + 1):
        try:
            t0 = time.time()

            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10,
            )

            dt_ms = int((time.time() - t0) * 1000)
            last_status = response.status_code

            logger.info(
                "TMDB GET %s status=%s ms=%s params=%s",
                path,
                response.status_code,
                dt_ms,
                params,
            )

            if response.status_code == 401:
                raise HTTPException(
                    status_code=401,
                    detail="Token TMDB invalide ou expiré",
                )

            if response.status_code == 429:
                if attempt < TMDB_MAX_RETRIES:
                    wait_s = TMDB_BACKOFF_BASE_S * (2 ** attempt)
                    logger.warning(
                        "TMDB rate limit 429 -> retry dans %.2fs",
                        wait_s,
                    )
                    time.sleep(wait_s)
                    continue

                raise HTTPException(
                    status_code=429,
                    detail="Rate limit TMDB : trop de requêtes",
                )

            if 500 <= response.status_code < 600:
                if attempt < TMDB_MAX_RETRIES:
                    wait_s = TMDB_BACKOFF_BASE_S * (2 ** attempt)
                    logger.warning(
                        "TMDB erreur %s -> retry dans %.2fs",
                        response.status_code,
                        wait_s,
                    )
                    time.sleep(wait_s)
                    continue

            response.raise_for_status()
            return response.json()

        except requests.exceptions.Timeout as e:
            last_err = e

            if attempt < TMDB_MAX_RETRIES:
                wait_s = TMDB_BACKOFF_BASE_S * (2 ** attempt)
                logger.warning("TMDB timeout -> retry dans %.2fs", wait_s)
                time.sleep(wait_s)
                continue

            raise HTTPException(status_code=504, detail="TMDB timeout")

        except requests.exceptions.RequestException as e:
            last_err = e

            if attempt < TMDB_MAX_RETRIES:
                wait_s = TMDB_BACKOFF_BASE_S * (2 ** attempt)
                logger.warning(
                    "Erreur réseau TMDB -> retry dans %.2fs err=%s",
                    wait_s,
                    e,
                )
                time.sleep(wait_s)
                continue

            raise HTTPException(
                status_code=502,
                detail=f"Erreur réseau TMDB: {e}",
            )

    raise HTTPException(
        status_code=502,
        detail=f"TMDB échec après retries status={last_status}, err={last_err}",
    )


def normalize_movie(movie: dict) -> dict:
    tmdb_id = movie.get("id") or movie.get("tmdb_id")
    title = movie.get("title") or movie.get("name") or ""
    overview = movie.get("overview") or movie.get("description") or ""
    release_date = movie.get("release_date") or ""

    year = (
        release_date[:4]
        if isinstance(release_date, str) and len(release_date) >= 4
        else movie.get("year") or ""
    )

    poster_path = movie.get("poster_path") or ""

    if poster_path:
        image_url = f"{TMDB_IMAGE_BASE}{poster_path}"
    else:
        image_url = movie.get("image_url") or ""

    return {
    "tmdb_id": tmdb_id,
    "title": title,
    "year": year,
    "description": overview,
    "image_url": image_url,
    "genre_ids": movie.get("genre_ids", []),
    }


# =========================
# Routes générales
# =========================

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "NACO backend fonctionne",
    }


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=200)


# =========================
# Routes films TMDB
# =========================

@app.get("/movies")
def get_movies(
    limit: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
):
    now = time.time()

    entry = MOVIES_CACHE.get(page)

    if entry is not None and (now - entry["ts"]) < MOVIES_CACHE_TTL:
        movies = entry["data"]
    else:
        data = tmdb_get(
            "/movie/popular",
            params={
                "language": "fr-FR",
                "page": page,
            },
        )

        movies = [normalize_movie(movie) for movie in data.get("results", [])]
        MOVIES_CACHE[page] = {"ts": now, "data": movies}

    if page == 1:
        CACHE["data"] = movies
        CACHE["ts"] = now

    movies_slice = movies[:limit] if limit is not None else movies

    return {
        "status": "ok",
        "count": len(movies_slice),
        "results": movies_slice,
        "page": page,
    }


@app.get("/movies/search")
def search_movies(
    q: str = Query(..., min_length=1),
    limit: int | None = Query(default=None, ge=1),
    page: int = Query(default=1, ge=1),
):
    now = time.time()
    key = f"{q.strip().lower()}::p{page}"

    entry = SEARCH_CACHE.get(key)

    if entry is not None and (now - entry["ts"]) < SEARCH_CACHE_TTL:
        movies = entry["data"]
    else:
        data = tmdb_get(
            "/search/movie",
            params={
                "query": q,
                "language": "fr-FR",
                "page": page,
            },
        )

        movies = [normalize_movie(movie) for movie in data.get("results", [])]
        SEARCH_CACHE[key] = {"ts": now, "data": movies}

    movies_slice = movies[:limit] if limit is not None else movies

    return {
        "status": "ok",
        "count": len(movies_slice),
        "results": movies_slice,
        "query": q,
        "page": page,
    }


# =========================
# Routes favoris PostgreSQL
# =========================

@app.get("/favorites")
def get_favorites():
    if SessionLocal is None:
        raise HTTPException(
            status_code=500,
            detail="Base de données non configurée. Vérifie DATABASE_URL.",
        )

    db = SessionLocal()

    try:
        favorites = db.query(Favorite).all()

        return {
            "status": "ok",
            "count": len(favorites),
            "results": [
                {
                    "id": favorite.id,
                    "tmdb_id": favorite.tmdb_id,
                    "title": favorite.title,
                    "year": favorite.year,
                    "description": favorite.description,
                    "image_url": favorite.image_url,
                }
                for favorite in favorites
            ],
        }

    finally:
        db.close()


@app.post("/favorites")
def add_favorite(movie: FavoriteCreate):
    if SessionLocal is None:
        raise HTTPException(
            status_code=500,
            detail="Base de données non configurée. Vérifie DATABASE_URL.",
        )

    db = SessionLocal()

    try:
        existing = (
            db.query(Favorite)
            .filter(Favorite.tmdb_id == movie.tmdb_id)
            .first()
        )

        if existing:
            return {
                "status": "ok",
                "message": "Film déjà présent dans les favoris",
                "favorite": {
                    "id": existing.id,
                    "tmdb_id": existing.tmdb_id,
                    "title": existing.title,
                    "year": existing.year,
                    "description": existing.description,
                    "image_url": existing.image_url,
                },
            }

        favorite = Favorite(
            tmdb_id=movie.tmdb_id,
            title=movie.title,
            year=movie.year,
            description=movie.description,
            image_url=movie.image_url,
        )

        db.add(favorite)
        db.commit()
        db.refresh(favorite)

        return {
            "status": "ok",
            "message": "Film ajouté aux favoris",
            "favorite": {
                "id": favorite.id,
                "tmdb_id": favorite.tmdb_id,
                "title": favorite.title,
                "year": favorite.year,
                "description": favorite.description,
                "image_url": favorite.image_url,
            },
        }

    finally:
        db.close()


@app.delete("/favorites/{tmdb_id}")
def delete_favorite(tmdb_id: int):
    if SessionLocal is None:
        raise HTTPException(
            status_code=500,
            detail="Base de données non configurée. Vérifie DATABASE_URL.",
        )

    db = SessionLocal()

    try:
        favorite = (
            db.query(Favorite)
            .filter(Favorite.tmdb_id == tmdb_id)
            .first()
        )

        if not favorite:
            raise HTTPException(
                status_code=404,
                detail="Favori introuvable",
            )

        db.delete(favorite)
        db.commit()

        return {
            "status": "ok",
            "message": "Film supprimé des favoris",
            "tmdb_id": tmdb_id,
        }

    finally:
        db.close()


# =========================
# Route export JSON
# =========================

EXPORT_DIR = Path(__file__).parent / "exports"
EXPORT_DIR.mkdir(exist_ok=True)


@app.get("/export/movies.json")
def export_movies_json(
    pages: int = Query(default=5, ge=1, le=50),
):
    movies_all: list[dict] = []

    for page in range(1, pages + 1):
        data = tmdb_get(
            "/movie/popular",
            params={
                "language": "fr-FR",
                "page": page,
            },
        )

        movies_all.extend(
            [normalize_movie(movie) for movie in data.get("results", [])]
        )

        time.sleep(0.25)

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out = EXPORT_DIR / f"movies_popular_p{pages}_{stamp}.json"

    out.write_text(
        json.dumps(movies_all, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    return {
        "status": "ok",
        "count": len(movies_all),
        "exported_file": out.name,
    }
