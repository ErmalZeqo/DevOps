#!/bin/bash

set -e

echo "===================================="
echo " Lancement Kubernetes du projet NACO"
echo " Mode : Minikube"
echo "===================================="

if ! command -v minikube >/dev/null 2>&1; then
  echo "Erreur : Minikube n'est pas installe ou pas disponible."
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Erreur : kubectl n'est pas installe ou pas disponible."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Erreur : Docker n'est pas installe ou pas disponible."
  exit 1
fi

if [ ! -f k8s/02-secret.yaml ]; then
  echo "Erreur : k8s/02-secret.yaml est manquant."
  echo "Copiez k8s/02-secret.example.yaml vers k8s/02-secret.yaml puis ajoutez votre TMDB_TOKEN."
  echo "Commande : cp k8s/02-secret.example.yaml k8s/02-secret.yaml"
  exit 1
fi

echo "Demarrage de Minikube..."
minikube start

echo "Activation de l'Ingress Minikube..."
minikube addons enable ingress

echo "Configuration du frontend pour Kubernetes..."
echo "VITE_API_BASE_URL=/api" > frontend/.env.production

echo "Utilisation du Docker interne de Minikube..."
eval $(minikube docker-env)

echo "Build image backend..."
docker build -t naco-backend:latest ./backend

echo "Build image frontend..."
docker build -t naco-frontend:latest ./frontend

echo "Deploiement Kubernetes..."
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-configmap.yaml
kubectl apply -f k8s/02-secret.yaml
kubectl apply -f k8s/03-postgres-pvc.yaml
kubectl apply -f k8s/04-postgres-deployment.yaml
kubectl apply -f k8s/05-postgres-service.yaml

echo "Attente de PostgreSQL..."
kubectl wait --namespace naco \
  --for=condition=Ready pod \
  --selector=app=naco-postgres \
  --timeout=180s

kubectl apply -f k8s/06-backend-deployment.yaml
kubectl apply -f k8s/07-backend-service.yaml
kubectl apply -f k8s/08-frontend-deployment.yaml
kubectl apply -f k8s/09-frontend-service.yaml
kubectl apply -f k8s/10-ingress.yaml
kubectl apply -f k8s/11-backend-hpa.yaml
kubectl apply -f k8s/12-frontend-hpa.yaml

echo "Etat des ressources :"
kubectl get all -n naco
kubectl get ingress -n naco
kubectl get pvc -n naco

echo "===================================="
echo " Deploiement termine"
echo "===================================="
echo "Ajoutez l'IP Minikube dans /etc/hosts si ce n'est pas deja fait :"
echo "$(minikube ip) naco.local"
echo ""
echo "Application : http://naco.local"
echo "API films   : http://naco.local/api/movies"
echo "API favoris : http://naco.local/api/favorites"
