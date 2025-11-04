# 🚀 Despliegue en Kubernetes

Instrucciones para desplegar la API RAG Agent en Kubernetes (Google Cloud Platform).

## 📋 Pre-requisitos

1. **Docker** instalado y configurado
2. **kubectl** configurado con acceso al cluster
3. **Namespace `coonverso`** creado en el cluster
4. **Google Cloud CLI** autenticado
5. **Permisos** para push al registry: `us-central1-docker.pkg.dev/coonverso/middleware-crm/`

## ⚙️ Configuración

### 1. Actualizar variables de entorno

Edita el archivo `k8s/deployment.yaml` y actualiza las siguientes variables:

```yaml
env:
  # OpenAI
  - name: OPENAI_API_KEY
    value: 'sk-proj-TU-KEY-AQUI'

  # Pinecone
  - name: PINECONE_API_KEY
    value: 'TU-KEY-AQUI'
  - name: PINECONE_INDEX_NAME
    value: 'cec-epn-docs'

  # Supabase
  - name: SUPABASE_URL
    value: 'https://tu-proyecto.supabase.co'
  - name: SUPABASE_ANON_KEY
    value: 'TU-KEY-AQUI'

  # Perplexity (opcional)
  - name: PERPLEXITY_API_KEY
    value: 'pplx-TU-KEY-AQUI'
```

### 2. Verificar el namespace

```bash
kubectl get namespace coonverso
```

Si no existe, créalo:

```bash
kubectl create namespace coonverso
```

## 🚀 Despliegue

### Opción 1: Script Automático (Recomendado)

```bash
./deploy.sh
```

Este script:

1. ✅ Obtiene el tag actual de la imagen
2. ✅ Incrementa automáticamente la versión (1.0.0 → 1.0.1)
3. ✅ Construye la imagen Docker para `linux/amd64`
4. ✅ Sube la imagen al registry de GCP
5. ✅ Actualiza el archivo `deployment.yaml`
6. ✅ Aplica los manifiestos en Kubernetes
7. ✅ Verifica el estado del deployment
8. ✅ Muestra los logs recientes

### Opción 2: Manual

```bash
# 1. Construir la imagen
docker build --platform linux/amd64 -t us-central1-docker.pkg.dev/coonverso/middleware-crm/rag-agent-api:1.0.X ./

# 2. Push al registry
docker push us-central1-docker.pkg.dev/coonverso/middleware-crm/rag-agent-api:1.0.X

# 3. Actualizar deployment.yaml con el nuevo tag

# 4. Aplicar manifiestos
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 5. Verificar
kubectl rollout status deployment/rag-agent-api -n coonverso
```

## 🔍 Verificación

### Ver pods

```bash
kubectl get pods -n coonverso -l app=rag-agent-api
```

### Ver logs

```bash
# Logs en tiempo real
kubectl logs -n coonverso -l app=rag-agent-api -f

# Logs de un pod específico
kubectl logs -n coonverso <pod-name>
```

### Describir pod (para debugging)

```bash
kubectl describe pod -n coonverso <pod-name>
```

### Health check

```bash
# Port-forward al servicio
kubectl port-forward -n coonverso service/rag-agent-api-service 3001:80

# En otra terminal
curl http://localhost:3001/api/health
```

### Test completo

```bash
# Con port-forward activo
curl -X POST http://localhost:3001/api/chat \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId": "test-k8s",
    "idEmpresa": "coonverso",
    "query": "¿Qué cursos ofrecen?"
  }'
```

## 📊 Monitoreo

### Estado del deployment

```bash
kubectl get deployment rag-agent-api -n coonverso
```

### Estado del servicio

```bash
kubectl get service rag-agent-api-service -n coonverso
```

### Eventos recientes

```bash
kubectl get events -n coonverso --sort-by='.lastTimestamp'
```

### Métricas de recursos

```bash
kubectl top pods -n coonverso -l app=rag-agent-api
```

## 🔄 Actualización

Para actualizar el código:

1. Haz tus cambios en el código
2. Ejecuta `./deploy.sh`
3. El script automáticamente:
   - Incrementa la versión
   - Construye nueva imagen
   - La sube al registry
   - Actualiza el deployment
   - Kubernetes hace un rolling update sin downtime

## 🛑 Rollback

Si algo sale mal:

```bash
# Ver historial de deployments
kubectl rollout history deployment/rag-agent-api -n coonverso

# Rollback a la versión anterior
kubectl rollout undo deployment/rag-agent-api -n coonverso

# Rollback a una versión específica
kubectl rollout undo deployment/rag-agent-api -n coonverso --to-revision=2
```

## 🗑️ Eliminar deployment

```bash
kubectl delete -f k8s/deployment.yaml
kubectl delete -f k8s/service.yaml

# O todo a la vez
kubectl delete -f k8s/
```

## 🔧 Troubleshooting

### Pods en estado CrashLoopBackOff

```bash
# Ver logs del pod con error
kubectl logs -n coonverso <pod-name> --previous

# Verificar variables de entorno
kubectl exec -n coonverso <pod-name> -- env | grep -E 'OPENAI|PINECONE|SUPABASE'
```

### ImagePullBackOff

```bash
# Verificar que la imagen existe en el registry
gcloud artifacts docker images list us-central1-docker.pkg.dev/coonverso/middleware-crm/rag-agent-api

# Verificar permisos del service account
kubectl describe pod -n coonverso <pod-name>
```

### Health checks fallando

```bash
# Conectarse al pod
kubectl exec -it -n coonverso <pod-name> -- sh

# Dentro del pod, probar el health check
wget -qO- http://localhost:3001/api/health
```

### Lentitud en el startup

- Los health checks tienen `initialDelaySeconds: 60` por la inicialización de Pinecone/OpenAI
- Si sigue fallando, aumentar `initialDelaySeconds` en `deployment.yaml`

## 📝 Notas

- **Réplicas**: Actualmente configuradas en 2 para alta disponibilidad
- **Recursos**: 512Mi-1Gi RAM, 250m-500m CPU por pod
- **Health checks**: Liveness y Readiness en `/api/health`
- **Puerto interno**: 3001
- **Puerto del servicio**: 80 (ClusterIP)

## 🔒 Seguridad

⚠️ **IMPORTANTE**: Las credenciales están hardcodeadas en `deployment.yaml` para simplicidad. En producción considera:

1. **Usar Secrets de Kubernetes**:

   ```bash
   kubectl create secret generic rag-agent-secrets \
     --from-literal=OPENAI_API_KEY=sk-... \
     --from-literal=PINECONE_API_KEY=... \
     -n coonverso
   ```

2. **Google Secret Manager** con Workload Identity

3. **HashiCorp Vault** para gestión centralizada de secretos

## 🌐 Exposición Externa

Si necesitas exponer la API externamente (no solo dentro del cluster):

### Opción 1: Ingress

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: rag-agent-ingress
  namespace: coonverso
spec:
  rules:
    - host: rag-api.coonverso.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: rag-agent-api-service
                port:
                  number: 80
```

### Opción 2: LoadBalancer

```yaml
# En service.yaml, cambiar:
spec:
  type: LoadBalancer # En lugar de ClusterIP
```

---

**Desarrollado por**: David Mejía
**Fecha**: Noviembre 2025
**Proyecto**: Coonverso - CEC-EPN RAG Agent
