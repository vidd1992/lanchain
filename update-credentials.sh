#!/bin/bash

# ========================================
# Helper: Actualizar Credenciales en K8s
# ========================================

echo "🔐 Actualizador de Credenciales - RAG Agent API"
echo ""

DEPLOYMENT_FILE="k8s/deployment.yaml"

# Función para actualizar una variable
update_env() {
  local VAR_NAME=$1
  local CURRENT_VALUE=$(grep -A 1 "name: $VAR_NAME" $DEPLOYMENT_FILE | grep "value:" | sed 's/.*value: "\(.*\)"/\1/')

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📝 Variable: $VAR_NAME"
  echo "🔹 Valor actual: ${CURRENT_VALUE:0:20}..."
  echo ""
  read -p "🆕 Nuevo valor (Enter para mantener actual): " NEW_VALUE

  if [ ! -z "$NEW_VALUE" ]; then
    sed -i.bak "s|name: $VAR_NAME\(.*\)value: \".*\"|name: $VAR_NAME\1value: \"$NEW_VALUE\"|" $DEPLOYMENT_FILE
    echo "✅ Actualizado!"
  else
    echo "⏭️  Saltado"
  fi
  echo ""
}

echo "Actualizaremos las credenciales en: $DEPLOYMENT_FILE"
echo ""
read -p "¿Continuar? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
  echo "❌ Cancelado"
  exit 0
fi

echo ""

# Actualizar cada variable
update_env "OPENAI_API_KEY"
update_env "PINECONE_API_KEY"
update_env "PINECONE_INDEX_NAME"
update_env "SUPABASE_URL"
update_env "SUPABASE_ANON_KEY"
update_env "PERPLEXITY_API_KEY"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Credenciales actualizadas!"
echo ""
echo "📌 Próximos pasos:"
echo "   1. Revisar cambios: git diff k8s/deployment.yaml"
echo "   2. Desplegar: ./deploy.sh"
echo ""
