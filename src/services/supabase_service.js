import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';

/**
 * Servicio de Supabase para persistir conversaciones
 */
export class SupabaseService {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Inicializar cliente de Supabase
   */
  initialize() {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn(
          '⚠️  Supabase no configurado. Las conversaciones solo se guardarán en memoria.'
        );
        return false;
      }

      this.client = createClient(supabaseUrl, supabaseKey);
      this.initialized = true;
      console.log('✅ Supabase inicializado correctamente');
      return true;
    } catch (error) {
      console.error('❌ Error al inicializar Supabase:', error.message);
      return false;
    }
  }

  /**
   * Crear o actualizar sesión de conversación
   * @param {string} sessionId - ID de la sesión
   * @param {string} idEmpresa - ID de la empresa
   * @param {string} userId - ID del usuario (opcional)
   * @returns {Promise<Object>} - Sesión creada/actualizada
   */
  async upsertSession(sessionId, idEmpresa, userId = null) {
    if (!this.initialized) return null;

    try {
      const { data, error } = await this.client
        .from('conversation_sessions')
        .upsert(
          {
            session_id: sessionId,
            id_empresa: idEmpresa,
            user_id: userId,
            last_activity: new Date().toISOString(),
          },
          {
            onConflict: 'session_id,id_empresa',
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al crear/actualizar sesión:', error.message);
      return null;
    }
  }

  /**
   * Guardar mensaje en la conversación
   * @param {string} sessionId - ID de la sesión
   * @param {string} idEmpresa - ID de la empresa
   * @param {string} role - 'user' | 'assistant'
   * @param {string} content - Contenido del mensaje
   * @param {Object} metadata - Metadata adicional (source, score, etc.)
   * @returns {Promise<Object>} - Mensaje guardado
   */
  async saveMessage(sessionId, idEmpresa, role, content, metadata = {}) {
    if (!this.initialized) return null;

    try {
      // Primero, actualizar la sesión
      await this.upsertSession(sessionId, idEmpresa);

      // Luego, insertar el mensaje
      const { data, error } = await this.client
        .from('conversation_messages')
        .insert({
          session_id: sessionId,
          id_empresa: idEmpresa,
          role,
          content,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al guardar mensaje:', error.message);
      return null;
    }
  }

  /**
   * Obtener historial de conversación
   * @param {string} sessionId - ID de la sesión
   * @param {string} idEmpresa - ID de la empresa
   * @param {number} limit - Número máximo de mensajes
   * @returns {Promise<Array>} - Array de mensajes
   */
  async getHistory(sessionId, idEmpresa, limit = 10) {
    if (!this.initialized) return [];

    try {
      const { data, error } = await this.client
        .from('conversation_messages')
        .select('*')
        .eq('session_id', sessionId)
        .eq('id_empresa', idEmpresa)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Retornar en orden cronológico (más antiguos primero)
      return data.reverse();
    } catch (error) {
      console.error('Error al obtener historial:', error.message);
      return [];
    }
  }

  /**
   * Guardar resumen de conversación
   * @param {string} sessionId - ID de la sesión
   * @param {string} idEmpresa - ID de la empresa
   * @param {string} summary - Resumen de la conversación
   * @returns {Promise<boolean>} - true si se guardó correctamente
   */
  async saveSummary(sessionId, idEmpresa, summary) {
    if (!this.initialized) return false;

    try {
      const { error } = await this.client
        .from('conversation_sessions')
        .update({ summary })
        .eq('session_id', sessionId)
        .eq('id_empresa', idEmpresa);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error al guardar resumen:', error.message);
      return false;
    }
  }

  /**
   * Obtener resumen de una sesión
   * @param {string} sessionId - ID de la sesión
   * @param {string} idEmpresa - ID de la empresa
   * @returns {Promise<string|null>} - Resumen o null
   */
  async getSummary(sessionId, idEmpresa) {
    if (!this.initialized) return null;

    try {
      const { data, error } = await this.client
        .from('conversation_sessions')
        .select('summary')
        .eq('session_id', sessionId)
        .eq('id_empresa', idEmpresa)
        .single();

      if (error) throw error;
      return data?.summary || null;
    } catch (error) {
      console.error('Error al obtener resumen:', error.message);
      return null;
    }
  }

  /**
   * Obtener todas las sesiones de una empresa
   * @param {string} idEmpresa - ID de la empresa
   * @param {number} limit - Número máximo de sesiones
   * @returns {Promise<Array>} - Array de sesiones
   */
  async getSessionsByCompany(idEmpresa, limit = 50) {
    if (!this.initialized) return [];

    try {
      const { data, error } = await this.client
        .from('conversation_sessions')
        .select('*')
        .eq('id_empresa', idEmpresa)
        .order('last_activity', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al obtener sesiones:', error.message);
      return [];
    }
  }

  /**
   * Limpiar sesiones antiguas (más de X días)
   * @param {string} idEmpresa - ID de la empresa
   * @param {number} days - Días de antigüedad
   * @returns {Promise<number>} - Número de sesiones eliminadas
   */
  async cleanOldSessions(idEmpresa, days = 30) {
    if (!this.initialized) return 0;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await this.client
        .from('conversation_sessions')
        .delete()
        .eq('id_empresa', idEmpresa)
        .lt('last_activity', cutoffDate.toISOString())
        .select();

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('Error al limpiar sesiones antiguas:', error.message);
      return 0;
    }
  }

  /**
   * Obtener estadísticas de una empresa
   * @param {string} idEmpresa - ID de la empresa
   * @returns {Promise<Object>} - Estadísticas
   */
  async getCompanyStats(idEmpresa) {
    if (!this.initialized) return null;

    try {
      // Contar sesiones totales
      const { count: sessionsCount } = await this.client
        .from('conversation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('id_empresa', idEmpresa);

      // Contar mensajes totales
      const { count: messagesCount } = await this.client
        .from('conversation_messages')
        .select('*', { count: 'exact', head: true })
        .eq('id_empresa', idEmpresa);

      // Obtener última actividad
      const { data: lastSession } = await this.client
        .from('conversation_sessions')
        .select('last_activity')
        .eq('id_empresa', idEmpresa)
        .order('last_activity', { ascending: false })
        .limit(1)
        .single();

      return {
        totalSessions: sessionsCount || 0,
        totalMessages: messagesCount || 0,
        lastActivity: lastSession?.last_activity || null,
      };
    } catch (error) {
      console.error('Error al obtener estadísticas:', error.message);
      return null;
    }
  }
}
