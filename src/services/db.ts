// @ts-nocheck
/**
 * db.ts — capa de abstracción de persistencia.
 *
 * PUNTO ÚNICO DE MIGRACIÓN AL BACKEND.
 * Para conectar la API real, reemplazar los imports de localStorage/*
 * por los correspondientes imports de api/* y actualizar las funciones.
 * El resto del código (hooks, componentes) no cambia.
 *
 * Ejemplo de migración para archivos:
 *   // Antes:
 *   import * as filesStorage from './localStorage/filesStorage';
 *   // Después:
 *   import * as filesStorage from './api/filesAPI';
 *   // Y filesAPI.ts expone las mismas funciones pero con fetch() en lugar de localStorage.
 */

// ─── Módulo Información ────────────────────────────────────────────────────
import * as filesStorage     from './localStorage/filesStorage';
import * as sectorsStorage   from './localStorage/sectorsStorage';
import * as downloadsStorage from './localStorage/downloadsStorage';
import * as periodsStorage   from './localStorage/periodsStorage';
import * as usersStorage     from './localStorage/usersStorage';

// ─── Módulo Reclamos ───────────────────────────────────────────────────────
import * as reclamosStorage       from './localStorage/reclamosStorage';
import * as reclamosConfigStorage from './localStorage/reclamosConfigStorage';

export const db = {

  // ── Archivos (módulo Información) ──────────────────────────────────────
  // API equivalente: GET/POST/PUT/DELETE /api/files
  files: {
    getAll:        filesStorage.getAll,
    saveAll:       filesStorage.saveAll,
    getAuditLog:   filesStorage.getAuditLog,
    saveAuditLog:  filesStorage.saveAuditLog,
    appendAudit:   filesStorage.appendAuditEntry,
  },

  // ── Sectores y Sedes ────────────────────────────────────────────────────
  // API equivalente: GET/POST/PUT/DELETE /api/sectors  y  /api/sites
  sectors: {
    getAllSectors: sectorsStorage.getAllSectors,
    saveSectors:  sectorsStorage.saveSectors,
    getAllSites:   sectorsStorage.getAllSites,
    saveSites:    sectorsStorage.saveSites,
  },

  // ── Descargas y contadores ──────────────────────────────────────────────
  // API equivalente: GET/POST /api/downloads  (contadores de numeración)
  downloads: {
    getCounters:        downloadsStorage.getCounters,
    saveCounters:       downloadsStorage.saveCounters,
    getDownloadedFiles: downloadsStorage.getDownloadedFiles,
    saveDownloadedFiles:downloadsStorage.saveDownloadedFiles,
    getLogs:            downloadsStorage.getLogs,
    saveLogs:           downloadsStorage.saveLogs,
  },

  // ── Liquidaciones (períodos) ────────────────────────────────────────────
  // API equivalente: GET/POST/PUT/DELETE /api/periods
  periods: {
    getAll:        periodsStorage.getAll,
    saveAll:       periodsStorage.saveAll,
    getSelected:   periodsStorage.getSelected,
    saveSelected:  periodsStorage.saveSelected,
  },

  // ── Usuarios y sesión ───────────────────────────────────────────────────
  // API equivalente: POST /api/auth/login  GET /api/users  etc.
  // NOTA: el login con LDAP/AD reemplaza solo usersStorage.getSession / saveSession
  users: {
    getAll:      usersStorage.getAll,
    saveAll:     usersStorage.saveAll,
    getById:     usersStorage.getById,
    upsert:      usersStorage.upsert,
    getSession:  usersStorage.getSession,
    saveSession: usersStorage.saveSession,
  },

  // ── Reclamos ────────────────────────────────────────────────────────────
  // API equivalente: GET/POST/PUT /api/reclamos
  reclamos: {
    getAll:          reclamosStorage.getAll,
    getById:         reclamosStorage.getById,
    create:          reclamosStorage.create,
    update:          reclamosStorage.update,
    softDelete:      reclamosStorage.softDelete,
    updateEstado:    reclamosStorage.updateEstado,
    addNotificacion: reclamosStorage.addNotificacion,
    addNotaInterna:  reclamosStorage.addNotaInterna,
  },

  // ── Configuración de Reclamos ───────────────────────────────────────────
  // API equivalente: GET/PUT /api/reclamos/config
  reclamosConfig: {
    get:  reclamosConfigStorage.getConfig,
    save: reclamosConfigStorage.saveConfig,
  },
};
