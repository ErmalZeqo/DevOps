#!/bin/bash

set -e

echo "===================================="
echo " Verification avant rendu NACO"
echo "===================================="

ERROR=0

check_missing() {
  if [ ! -f "$1" ]; then
    echo "Manquant : $1"
    ERROR=1
  else
    echo "OK : $1"
  fi
}

check_absent() {
  if [ -e "$1" ]; then
    echo "Attention : $1 ne doit pas etre dans le zip final ou sur Git."
    ERROR=1
  else
    echo "OK absent : $1"
  fi
}

check_missing README.md
check_missing docker-compose.yml
check_missing backend/Dockerfile
check_missing frontend/Dockerfile
check_missing backend/.env.example
check_missing k8s/02-secret.example.yaml
check_missing .gitlab-ci.yml
check_missing run.sh
check_missing run-k8s.sh

check_absent backend/.env
check_absent k8s/02-secret.yaml
check_absent frontend/node_modules
check_absent frontend/dist
check_absent backend/venv

if grep -q "eyJ" backend/.env.example 2>/dev/null; then
  echo "Attention : backend/.env.example semble contenir un vrai token. Remplacez-le par un placeholder."
  ERROR=1
fi

if [ "$ERROR" -eq 0 ]; then
  echo "Verification terminee : rien de bloquant detecte."
else
  echo "Verification terminee : corrections necessaires avant rendu."
  exit 1
fi
