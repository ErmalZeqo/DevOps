#!/bin/bash

set -e

echo "===================================="
echo " Lancement local du projet NACO"
echo " Mode : Docker Compose"
echo "===================================="

if ! command -v docker >/dev/null 2>&1; then
  echo "Erreur : Docker n'est pas installe ou pas disponible."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Erreur : Docker Compose n'est pas disponible."
  exit 1
fi

if [ ! -f backend/.env ]; then
  echo "Erreur : backend/.env est manquant."
  echo "Copiez backend/.env.example vers backend/.env puis ajoutez votre TMDB_TOKEN."
  echo "Commande : cp backend/.env.example backend/.env"
  exit 1
fi

echo "Configuration du frontend pour Docker Compose..."
echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > frontend/.env.production

echo "Arret des anciens conteneurs..."
docker compose down

echo "Construction et lancement des services..."
docker compose up --build
