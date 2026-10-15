# NACO - Catalogue de films

NACO est une application web de catalogue de films réalisée dans le cadre du projet OpsCI. L'objectif est de proposer une application complète avec un front-end, un back-end, une base de données, une API externe, Docker, Kubernetes et un pipeline CI/CD.

L'application permet d'afficher des films populaires, de rechercher un film, de charger plusieurs pages de résultats et de gérer une liste de favoris persistée en base PostgreSQL.

---

## 1. Fonctionnalités

- Catalogue dynamique de films récupérés depuis l'API TMDB.
- Barre de recherche connectée au back-end.
- Pagination avec un bouton **Charger plus**.
- Affichage des états de chargement et des erreurs.
- Ajout de films aux favoris.
- Affichage de la page favoris.
- Suppression d'un favori.
- Export JSON des films populaires.
- Déploiement local avec Docker Compose.
- Déploiement Kubernetes avec Services, Ingress, ConfigMap, Secret et volume persistant.
- Pipeline GitLab CI/CD pour vérifier le projet.

---

## 2. Architecture

```text
Utilisateur
   |
   v
Frontend React + Vite
   |
   | requetes HTTP
   v
Backend FastAPI
   |                  |
   | appels API       | SQLAlchemy
   v                  v
API TMDB          PostgreSQL
```

En local avec Docker Compose :

```text
frontend : http://localhost:5173
backend  : http://localhost:8000
base     : PostgreSQL dans le conteneur naco-db
```

En Kubernetes avec Ingress :

```text
http://naco.local           -> frontend
http://naco.local/api/...   -> backend
```

---

## 3. Technologies utilisées

### Frontend

- React
- Vite
- CSS
- Nginx pour servir le build en conteneur

### Backend

- Python
- FastAPI
- Uvicorn
- Requests pour appeler TMDB
- SQLAlchemy pour accéder à PostgreSQL
- python-dotenv pour charger les variables d'environnement

### Base de données

- PostgreSQL 16

### DevOps

- Docker
- Docker Compose
- Kubernetes
- Minikube
- GitLab CI/CD

---

## 4. Configuration des variables d'environnement

Le vrai token TMDB ne doit jamais être envoyé sur Git.

Créer le fichier de configuration backend :

```bash
cp backend/.env.example backend/.env
```

Puis modifier `backend/.env` :

```env
TMDB_TOKEN=votre_token_tmdb
DATABASE_URL=postgresql://naco_user:naco_password@naco-db:5432/naco
```

Pour Docker Compose, le nom du service PostgreSQL est `naco-db`.

Pour Kubernetes, la base est accessible avec le service `naco-postgres`, donc l'URL devient :

```env
DATABASE_URL=postgresql://naco_user:naco_password@naco-postgres:5432/naco
```

---

## 5. Lancement rapide avec Docker Compose

C'est la méthode la plus simple pour lancer toute l'application.

Vérifier d'abord que `backend/.env` existe.

Puis lancer :

```bash
./run.sh
```

Ou manuellement :

```bash
docker compose down
docker compose up --build
```

Accès :

```text
Frontend : http://localhost:5173
Backend  : http://localhost:8000
API films : http://localhost:8000/movies
API favoris : http://localhost:8000/favorites
```

---

## 6. Lancement sans Docker

Cette méthode est surtout utile pour développer.

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Le backend sera disponible sur :

```text
http://localhost:8000
```

### Frontend

Dans un autre terminal :

```bash
cd frontend
npm install
npm run dev
```

Le frontend sera disponible sur :

```text
http://localhost:5173
```

---

## 7. Routes API principales

### Films

```text
GET /movies?page=1
```

Retourne les films populaires depuis TMDB.

```text
GET /movies/search?q=matrix&page=1
```

Recherche des films avec TMDB.

### Favoris

```text
GET /favorites
```

Retourne la liste des favoris.

```text
POST /favorites
```

Ajoute un film aux favoris.

Exemple de corps JSON :

```json
{
  "tmdb_id": 603,
  "title": "Matrix",
  "year": "1999",
  "description": "Film de science-fiction",
  "image_url": "https://image.tmdb.org/t/p/w500/..."
}
```

```text
DELETE /favorites/{tmdb_id}
```

Supprime un favori.

### Export

```text
GET /export/movies.json?pages=5
```

Exporte plusieurs pages de films populaires dans `backend/exports/`.

---

---

## 8. Fonctionnement du frontend React (`App.jsx`)

Le fichier principal du frontend est :

```text
frontend/src/App.jsx
```

Il contient la logique principale de l'application React. C'est ce fichier qui fait le lien entre l'interface utilisateur et l'API FastAPI.

### Configuration de l'URL du backend

Au début du fichier, l'application définit l'adresse du backend avec une variable d'environnement :

```js
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
```

Cette ligne permet d'utiliser deux configurations différentes :

```text
Docker Compose local : http://127.0.0.1:8000
Kubernetes           : /api
```

En local, le frontend appelle directement le backend sur le port `8000`. En Kubernetes, le frontend appelle `/api`, puis l'Ingress redirige la requête vers le service backend.

### Chargement des films

La fonction de chargement des films récupère les films populaires depuis le backend :

```text
GET /movies?page=1
```

Elle met ensuite à jour l'état React qui contient la liste des films affichés. Cette fonction gère aussi l'état de chargement et les erreurs. Par exemple, si le backend ne répond pas ou si TMDB renvoie une erreur, un message d'erreur est affiché dans l'interface.

### Recherche de films

La recherche utilise la route backend :

```text
GET /movies/search?q=...&page=1
```

Quand l'utilisateur écrit un texte dans la barre de recherche, React envoie la recherche au backend. Le backend interroge ensuite l'API TMDB et renvoie les films correspondants au frontend.

### Pagination avec "Charger plus"

Le bouton **Charger plus** permet d'augmenter le numéro de page :

```text
page=1
page=2
page=3
```

À chaque clic, le frontend demande une nouvelle page au backend et ajoute les nouveaux films à la liste déjà affichée. Cela évite de charger trop de données en une seule fois.

### Gestion des favoris

Le fichier `App.jsx` gère aussi les favoris avec trois actions principales :

```text
GET    /favorites
POST   /favorites
DELETE /favorites/{tmdb_id}
```

- `GET /favorites` récupère les favoris enregistrés en base PostgreSQL.
- `POST /favorites` ajoute un film dans les favoris.
- `DELETE /favorites/{tmdb_id}` supprime un film des favoris.

L'interface vérifie aussi si un film est déjà dans les favoris afin d'éviter les doublons et d'adapter l'affichage des boutons.

### Organisation des films par genre

Le frontend contient une correspondance entre les identifiants de genres TMDB et leurs noms. Cela permet de regrouper les films par catégories, par exemple action, comédie ou science-fiction. Cette organisation rend l'affichage plus lisible et donne un rendu proche d'une plateforme de streaming.

### Bannière principale

La page d'accueil affiche une grande bannière avec un film mis en avant. Le film affiché dans la bannière est choisi à partir des films récupérés depuis l'API. L'utilisateur peut aussi changer de film mis en avant grâce aux boutons de navigation ou aux points de sélection.

### États React utilisés

L'application utilise plusieurs états React pour gérer l'interface :

```text
movies      -> liste des films affichés
favorites   -> liste des films favoris
loading     -> indique si une requête est en cours
error       -> message d'erreur éventuel
search      -> texte saisi dans la barre de recherche
page        -> page actuelle de pagination
activeTab   -> page affichée : accueil ou favoris
```

Ces états permettent de rendre l'application dynamique sans recharger toute la page.

### Résumé du rôle de `App.jsx`

En résumé, `App.jsx` centralise :

```text
- les appels au backend FastAPI ;
- l'affichage dynamique des films ;
- la recherche ;
- la pagination ;
- la gestion des favoris ;
- les messages de chargement et d'erreur ;
- l'organisation visuelle de la page.
```

Ce fichier est donc le coeur du frontend React. Il ne contient pas le token TMDB : le token reste uniquement côté backend, ce qui évite de l'exposer dans le navigateur.

## 9. Docker Compose

Le fichier `docker-compose.yml` lance trois services :

```text
frontend  -> React build servi par Nginx
backend   -> API FastAPI avec Uvicorn
db        -> PostgreSQL 16
```

La base utilise un volume Docker nommé :

```text
naco_pgdata
```

Ce volume permet de conserver les favoris même si les conteneurs sont redémarrés.

---

## 10. Kubernetes avec Minikube

Le dossier `k8s/` contient les manifests Kubernetes :

```text
00-namespace.yaml
01-configmap.yaml
02-secret.example.yaml
03-postgres-pvc.yaml
04-postgres-deployment.yaml
05-postgres-service.yaml
06-backend-deployment.yaml
07-backend-service.yaml
08-frontend-deployment.yaml
09-frontend-service.yaml
10-ingress.yaml
11-backend-hpa.yaml
12-frontend-hpa.yaml
README-kubernetes.md
```

### Préparer le secret Kubernetes

```bash
cp k8s/02-secret.example.yaml k8s/02-secret.yaml
```

Modifier `k8s/02-secret.yaml` avec le vrai token TMDB :

```yaml
TMDB_TOKEN: "votre_token_tmdb"
POSTGRES_PASSWORD: "naco_password"
DATABASE_URL: "postgresql://naco_user:naco_password@naco-postgres:5432/naco"
```

Ce fichier ne doit pas être envoyé sur Git.

### Déploiement automatique local

```bash
./run-k8s.sh
```

Ou manuellement :

```bash
minikube start
minikube addons enable ingress

eval $(minikube docker-env)

echo "VITE_API_BASE_URL=/api" > frontend/.env.production

docker build -t naco-backend:latest ./backend
docker build -t naco-frontend:latest ./frontend

kubectl apply -f k8s/
```

Vérifier :

```bash
kubectl get all -n naco
kubectl get ingress -n naco
kubectl get pvc -n naco
```

Ajouter l'adresse dans `/etc/hosts` :

```bash
minikube ip
sudo nano /etc/hosts
```

Ajouter une ligne du type :

```text
192.168.49.2 naco.local
```

Accès :

```text
Application : http://naco.local
API films   : http://naco.local/api/movies
API favoris : http://naco.local/api/favorites
```

---

## 11. GitLab CI/CD

Le fichier `.gitlab-ci.yml` définit un pipeline avec les étapes suivantes :

```text
test   -> vérification syntaxique du backend FastAPI
build  -> build du frontend React/Vite
docker -> vérification des Dockerfiles backend et frontend
deploy -> étape Kubernetes manuelle
```

Le déploiement Kubernetes est manuel car le cluster utilisé est Minikube, donc il tourne localement sur la machine de développement. GitLab ne peut pas accéder directement à ce cluster sans configuration supplémentaire comme un `KUBECONFIG` sécurisé ou un GitLab Kubernetes Agent.

---

## 12. Fichiers à ne pas envoyer sur Git

Les fichiers suivants sont ignorés par `.gitignore` :

```text
backend/.env
k8s/02-secret.yaml
node_modules/
frontend/dist/
backend/venv/
backend/exports/*.json
```

Les fichiers d'exemple doivent rester dans le projet :

```text
backend/.env.example
k8s/02-secret.example.yaml
```

---

## 13. Difficultés rencontrées

Pendant le projet, plusieurs points ont demandé des corrections :

- Adapter le frontend pour fonctionner à la fois en Docker Compose et en Kubernetes.
- Ne pas exposer le token TMDB côté frontend.
- Corriger l'Ingress Kubernetes pour séparer `/api` et le frontend.
- Gérer la différence entre `naco-db` en Docker Compose et `naco-postgres` en Kubernetes.
- Adapter le pipeline GitLab car Docker-in-Docker n'était pas disponible sur le runner utilisé.

---

## 14. Améliorations possibles

- Ajouter des tests unitaires backend.
- Ajouter des tests frontend.
- Ajouter un vrai registre Docker pour pousser les images.
- Automatiser le déploiement Kubernetes avec GitLab Agent.
- Ajouter Redis pour améliorer le cache.
- Ajouter des recommandations de films similaires.
- Améliorer la gestion des erreurs côté interface.

---

## 15. Commandes utiles

### Docker Compose

```bash
./run.sh
```

### Kubernetes

```bash
./run-k8s.sh
```

### Arrêter Docker Compose

```bash
docker compose down
```

### Supprimer le déploiement Kubernetes

```bash
kubectl delete namespace naco
```

---

## 16. Auteurs

Projet réalisé dans le cadre du module OpsCI.

Application : NACO, catalogue de films orienté données et API.
