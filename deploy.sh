#!/bin/bash

# ========================================
# Script de Despliegue RAG Agent API
# ========================================

# Salir inmediatamente si un comando falla
set -e

# Configuración
DEPLOYMENT_FILE="k8s/deployment.yaml"
SERVICE_FILE="k8s/service.yaml"
IMAGE_NAME="us-central1-docker.pkg.dev/coonverso/middleware-crm/rag-agent-api"
NAMESPACE="coonverso"

echo "=========================================="
echo "🚀 RAG Agent API - Deployment Script"
echo "=========================================="

# Obtener el tag actual de la imagen desde el archivo deployment.yaml
CURRENT_TAG=$(grep "image: $IMAGE_NAME" $DEPLOYMENT_FILE | sed "s|.*$IMAGE_NAME:\(.*\)$|\1|")
echo "📦 Current Tag: $CURRENT_TAG"

# Incrementar el tag
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_TAG"
MAJOR=${VERSION_PARTS[0]}
MINOR=${VERSION_PARTS[1]}
PATCH=${VERSION_PARTS[2]}
NEW_PATCH=$((PATCH + 1))
NEW_TAG="$MAJOR.$MINOR.$NEW_PATCH"
echo "🆕 New Tag: $NEW_TAG"

# Construir la imagen Docker para linux/amd64
echo ""
echo "🔨 Building Docker image with tag $NEW_TAG..."
docker build --platform linux/amd64 -t "$IMAGE_NAME:$NEW_TAG" ./

# Publicar la imagen Docker
echo ""
echo "📤 Pushing Docker image to registry..."
docker push "$IMAGE_NAME:$NEW_TAG"

# Actualizar el archivo deployment.yaml con el nuevo tag
echo ""
echo "📝 Updating deployment file..."
sed -i.bak "s|image: $IMAGE_NAME:$CURRENT_TAG|image: $IMAGE_NAME:$NEW_TAG|g" $DEPLOYMENT_FILE

# Aplicar los manifiestos de Kubernetes
echo ""
echo "☸️  Applying Kubernetes manifests..."
kubectl apply -f $DEPLOYMENT_FILE
kubectl apply -f $SERVICE_FILE

# Esperar un momento para que se creen los pods
echo ""
echo "⏳ Waiting for deployment to start..."
sleep 5

# Verificar el estado del deployment
echo ""
echo "📊 Checking deployment status..."
kubectl rollout status deployment/rag-agent-api -n $NAMESPACE --timeout=5m

# Verificar los pods en el namespace
echo ""
echo "🔍 Verifying pods in '$NAMESPACE' namespace..."
kubectl get pods -n $NAMESPACE -l app=rag-agent-api

# Verificar el servicio
echo ""
echo "🌐 Verifying service..."
kubectl get service rag-agent-api-service -n $NAMESPACE

# Mostrar los logs recientes del pod
echo ""
echo "📋 Recent logs from the first pod:"
POD_NAME=$(kubectl get pods -n $NAMESPACE -l app=rag-agent-api -o jsonpath="{.items[0].metadata.name}")
kubectl logs -n $NAMESPACE $POD_NAME --tail=20

echo ""
echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "📌 Useful commands:"
echo "  - View logs: kubectl logs -n $NAMESPACE -l app=rag-agent-api -f"
echo "  - Check pods: kubectl get pods -n $NAMESPACE -l app=rag-agent-api"
echo "  - Describe pod: kubectl describe pod -n $NAMESPACE $POD_NAME"
echo "  - Port forward: kubectl port-forward -n $NAMESPACE service/rag-agent-api-service 3001:80"
echo "  - Delete deployment: kubectl delete -f k8s/"
echo ""
