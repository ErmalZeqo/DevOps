# Déploiement Kubernetes - NACO

Ce dossier contient les manifests Kubernetes pour déployer l'application NACO.

## Architecture Kubernetes

- `naco-frontend` : application React buildée et servie par Nginx.
- `naco-backend` : API FastAPI exposant les routes `/movies`, `/movies/search`, `/favorites`, `/export/movies.json`.
- `naco-postgres` : base PostgreSQL utilisée pour persister les films favoris.
- `naco-config` : ConfigMap contenant la configuration non sensible.
- `naco-secret` : Secret contenant `TMDB_TOKEN`, `POSTGRES_PASSWORD` et `DATABASE_URL`.
- `naco-postgres-pvc` : volume persistant pour conserver les données PostgreSQL.
- `naco-ingress` : point d'entrée HTTP pour le frontend et l'API.

## Pré-requis

- Un cluster Kubernetes local ou distant : Minikube, Kind, Docker Desktop Kubernetes, etc.
- Un Ingress Controller, par exemple ingress-nginx.
- Les images Docker `naco-frontend:latest` et `naco-backend:latest` disponibles dans le cluster.

## Images locales avec Minikube

Si vous utilisez Minikube :

```bash
eval $(minikube docker-env)

docker build -t naco-backend:latest ./backend
docker build -t naco-frontend:latest ./frontend
```

## Configuration du Secret

Copier le fichier d'exemple :

```bash
cp k8s/02-secret.example.yaml k8s/02-secret.yaml
```

Modifier `k8s/02-secret.yaml` :

```yaml
TMDB_TOKEN: "votre_token_tmdb"
POSTGRES_PASSWORD: "naco_password"
DATABASE_URL: "postgresql://naco_user:naco_password@naco-postgres:5432/naco"
```

Ne pas envoyer `02-secret.yaml` dans Git.

## Déploiement

```bash
kubectl apply -f k8s/
```

Vérifier les ressources :

```bash
kubectl get all -n naco
kubectl get ingress -n naco
kubectl get pvc -n naco
```

## Accès local

Ajouter cette ligne dans `/etc/hosts` :

```text
127.0.0.1 naco.local
```

Avec Minikube, récupérer l'IP :

```bash
minikube ip
```

Puis mettre cette IP dans `/etc/hosts` :

```text
<MINIKUBE_IP> naco.local
```

Application :

```text
http://naco.local
```

API via Ingress :

```text
http://naco.local/api/movies
http://naco.local/api/favorites
```

## Alternative sans Ingress

Pour tester rapidement :

```bash
kubectl port-forward -n naco service/naco-frontend 5173:80
kubectl port-forward -n naco service/naco-backend 8000:8000
```

Frontend :

```text
http://localhost:5173
```

Backend :

```text
http://localhost:8000/movies
```

## Scaling

Le backend et le frontend sont configurés avec 2 replicas. Ils peuvent être scalés manuellement :

```bash
kubectl scale deployment naco-backend -n naco --replicas=3
kubectl scale deployment naco-frontend -n naco --replicas=3
```

Des HPA sont fournis pour montrer une stratégie d'autoscaling basée sur le CPU :

```bash
kubectl apply -f k8s/11-backend-hpa.yaml
kubectl apply -f k8s/12-frontend-hpa.yaml
```

PostgreSQL reste à 1 replica car c'est un composant stateful avec volume persistant. Pour un vrai environnement de production, on utiliserait plutôt un StatefulSet ou une base PostgreSQL managée.
