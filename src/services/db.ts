// @ts-nocheck
/**
 * db.ts — capa de abstracción de persistencia.
 * Todos los hooks y componentes acceden a datos a través de este objeto.
 * Cuando se conecte el backend real, solo se reemplaza la implementación
 * interna — los consumidores no cambian.
 */

import * as reclamosStorage from './localStorage/reclamosStorage';
import * as reclamosConfigStorage from './localStorage/reclamosConfigStorage';

export const db = {
  reclamos: {
    getAll: reclamosStorage.getAll,
    getById: reclamosStorage.getById,
    create: reclamosStorage.create,
    update: reclamosStorage.update,
    softDelete: reclamosStorage.softDelete,
    updateEstado: reclamosStorage.updateEstado,
    addNotificacion: reclamosStorage.addNotificacion,
    addNotaInterna: reclamosStorage.addNotaInterna,
  },
  reclamosConfig: {
    get: reclamosConfigStorage.getConfig,
    save: reclamosConfigStorage.saveConfig,
  },
};
