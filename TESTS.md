# NACO — Guide de test

## 1. Test avec Docker Compose

À la racine du projet :

```bash
./run.sh
```

Attendre le démarrage du backend Uvicorn.

Dans un deuxième terminal, tester les endpoints :

```bash
curl http://localhost:8000/
curl http://localhost:8000/movies
curl http://localhost:8000/favorites
```

Ouvrir ensuite l'application frontend :

http://localhost:5173

Pour arrêter les conteneurs :

```bash
docker compose down
```

## 2. Test avec Kubernetes

Lancer le script de déploiement :

```bash
./run-k8s.sh
```

Vérifier l'état des ressources :

```bash
kubectl get pods -n naco
kubectl get svc -n naco
kubectl get ingress -n naco
kubectl get pvc -n naco
```

Attendre que les pods soient prêts et affichent l'état `Running`.

Tester les endpoints :

```bash
curl http://naco.local/api/movies
curl http://naco.local/api/favorites
```

Ouvrir ensuite l'application :

http://naco.local

## 3. Dépannage

Si l'application ne répond pas, vérifier les pods, les services, les logs du backend et la configuration réseau avant de relancer les tests.
