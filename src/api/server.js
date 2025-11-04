import express from 'express';
import cors from 'cors';
import { RAGAgent } from '../agent/rag_agent.js';
import { SupabaseService } from '../services/supabase_service.js';
import { validateConfig } from '../config/env.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Inicializar Supabase
const supabaseService = new SupabaseService();
supabaseService.initialize();

// Almacén de agentes activos (por empresa)
const activeAgents = new Map();

/**
 * Obtener o crear agente para una sesión/empresa
 */
function getAgent(sessionId, idEmpresa) {
  const key = `${idEmpresa}-${sessionId}`;

  if (!activeAgents.has(key)) {
    const agent = new RAGAgent(sessionId, false, idEmpresa);
    activeAgents.set(key, agent);
  }

  return activeAgents.get(key);
}

/**
 * POST /api/chat
 * Enviar mensaje al agente
 *
 * Body:
 * {
 *   "sessionId": "session-123",
 *   "idEmpresa": "empresa-001",
 *   "query": "¿Qué cursos ofrecen?"
 * }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, idEmpresa, query } = req.body;

    // Validar parámetros requeridos
    if (!sessionId || !idEmpresa || !query) {
      return res.status(400).json({
        error: 'Parámetros requeridos: sessionId, idEmpresa, query',
      });
    }

    // Obtener agente
    const agent = getAgent(sessionId, idEmpresa);

    // Inicializar si no está inicializado
    if (!agent.initialized) {
      await agent.initialize();
    }

    // Procesar query
    const response = await agent.query(query);

    // Responder
    res.json({
      success: true,
      data: {
        sessionId,
        idEmpresa,
        query,
        answer: response.answer,
        source: response.source,
        ragResults: response.ragResults || [],
        citations: response.citations || [],
        timestamp: response.timestamp,
      },
    });
  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/history/:sessionId?idEmpresa=xxx
 * Obtener historial de una sesión
 *
 * Query params:
 * - idEmpresa: ID de la empresa (requerido)
 * - limit: Número máximo de mensajes (opcional, default 20)
 */
app.get('/api/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { idEmpresa, limit = 20 } = req.query;

    if (!idEmpresa) {
      return res.status(400).json({
        error: 'Parámetro requerido: idEmpresa',
      });
    }

    // Obtener historial desde Supabase
    const messages = await supabaseService.getHistory(
      sessionId,
      idEmpresa,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        sessionId,
        idEmpresa,
        messages,
        count: messages.length,
      },
    });
  } catch (error) {
    console.error('Error en /api/history:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sessions/:idEmpresa
 * Listar todas las sesiones de una empresa
 *
 * Query params:
 * - limit: Número máximo de sesiones (opcional, default 50)
 */
app.get('/api/sessions/:idEmpresa', async (req, res) => {
  try {
    const { idEmpresa } = req.params;
    const { limit = 50 } = req.query;

    const sessions = await supabaseService.getSessionsByCompany(
      idEmpresa,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: {
        idEmpresa,
        sessions,
        count: sessions.length,
      },
    });
  } catch (error) {
    console.error('Error en /api/sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/:idEmpresa
 * Obtener estadísticas de una empresa
 */
app.get('/api/stats/:idEmpresa', async (req, res) => {
  try {
    const { idEmpresa } = req.params;

    const stats = await supabaseService.getCompanyStats(idEmpresa);

    res.json({
      success: true,
      data: {
        idEmpresa,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Error en /api/stats:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/session/:sessionId?idEmpresa=xxx
 * Limpiar caché de un agente y cerrar sesión
 */
app.delete('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { idEmpresa } = req.query;

    if (!idEmpresa) {
      return res.status(400).json({
        error: 'Parámetro requerido: idEmpresa',
      });
    }

    const key = `${idEmpresa}-${sessionId}`;

    if (activeAgents.has(key)) {
      activeAgents.delete(key);
    }

    res.json({
      success: true,
      message: 'Sesión cerrada correctamente',
    });
  } catch (error) {
    console.error('Error en /api/session:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/health
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeAgents: activeAgents.size,
  });
});

/**
 * GET /
 * Documentación básica del API
 */
app.get('/', (req, res) => {
  res.json({
    name: 'RAG Agent API',
    version: '1.0.0',
    endpoints: {
      'POST /api/chat': 'Enviar mensaje al agente',
      'GET /api/history/:sessionId': 'Obtener historial de conversación',
      'GET /api/sessions/:idEmpresa': 'Listar sesiones de una empresa',
      'GET /api/stats/:idEmpresa': 'Obtener estadísticas de una empresa',
      'DELETE /api/session/:sessionId': 'Cerrar sesión y limpiar caché',
      'GET /api/health': 'Health check',
    },
    documentation: 'https://github.com/tu-repo/docs',
  });
});

// Iniciar servidor
async function startServer() {
  try {
    // Validar configuración
    console.log('🔧 Validando configuración...');
    validateConfig();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🚀 Servidor RAG Agent API iniciado`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📚 Documentación: http://localhost:${PORT}/`);
      console.log(`💚 Health check: http://localhost:${PORT}/api/health`);
      console.log(`${'='.repeat(60)}\n`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

// Manejo de cierre graceful
process.on('SIGTERM', () => {
  console.log('\n⚠️  SIGTERM recibido, cerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n⚠️  SIGINT recibido, cerrando servidor...');
  process.exit(0);
});

// Iniciar
startServer();
