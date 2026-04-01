// @ts-nocheck
import React, { useMemo, useState } from "react";
import { formatDate } from "../../lib/time";

const AUDIT_KEY = "dataflow-audit-log-v1";

export function SuperadminDashboard({ onClose, files, downloadLogs, usersSnap, periods, periodNameById }: any) {
  const [tab, setTab] = useState("actividad");

  const auditLog = useMemo(() => {
    try { return JSON.parse(localStorage.getItem(AUDIT_KEY) || "[]"); }
    catch { return []; }
  }, []);

  const userActivity = useMemo(() => {
    const map = new Map();
    for (const u of usersSnap || []) {
      map.set(u.id, { id: u.id, username: u.username, displayName: u.displayName || u.username, role: u.role, uploads: 0, downloads: 0, lastAction: null });
    }
    for (const f of files || []) {
      const uid = f.byUserId || "";
      if (!map.has(uid)) map.set(uid, { id: uid, username: f.byUsername || uid, displayName: f.byUsername || uid, role: "?", uploads: 0, downloads: 0, lastAction: null });
      const e = map.get(uid);
      e.uploads += 1;
      if (!e.lastAction || f.at > e.lastAction) e.lastAction = f.at;
    }
    for (const dl of downloadLogs || []) {
      const uid = dl.usuarioId || "";
      if (!map.has(uid)) map.set(uid, { id: uid, username: dl.usuarioNombre || uid, displayName: dl.usuarioNombre || uid, role: "?", uploads: 0, downloads: 0, lastAction: null });
      const e = map.get(uid);
      e.downloads += 1;
      if (!e.lastAction || dl.timestamp > e.lastAction) e.lastAction = dl.timestamp;
    }
    return Array.from(map.values()).sort((a, b) => (b.lastAction || "").localeCompare(a.lastAction || ""));
  }, [files, downloadLogs, usersSnap]);

  const RLABELS = { rrhh: "RRHH", sueldos: "Sueldos", admin: "Admin", superadmin: "SuperAdmin" };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div>
            <h3 className="font-semibold text-neutral-100">📊 Dashboard — Super Administrador</h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              {(files || []).length} archivos · {(usersSnap || []).length} usuarios · {(periods || []).length} liquidaciones
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-200 text-sm px-3 py-1.5 rounded-lg hover:bg-neutral-800">Cerrar</button>
        </div>
        <div className="flex gap-1 px-5 pt-3">
          {["actividad", "auditoria"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t ? "bg-neutral-700 text-neutral-100" : "text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"}`}>
              {t === "actividad" ? "Actividad de usuarios" : "Log de auditoría"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "actividad" && (
            <table className="w-full text-xs">
              <thead className="text-neutral-400 sticky top-0 bg-neutral-900">
                <tr>
                  <th className="text-left py-2 pr-4">Usuario</th>
                  <th className="text-left py-2 pr-4">Rol</th>
                  <th className="text-right py-2 pr-4">Archivos subidos</th>
                  <th className="text-right py-2 pr-4">Descargas</th>
                  <th className="text-left py-2">Última acción</th>
                </tr>
              </thead>
              <tbody>
                {userActivity.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-neutral-500">Sin datos</td></tr>}
                {userActivity.map((u) => (
                  <tr key={u.id} className="border-t border-neutral-800">
                    <td className="py-2 pr-4"><div className="text-neutral-200 font-medium">{u.displayName}</div>{u.displayName !== u.username && <div className="text-neutral-500">{u.username}</div>}</td>
                    <td className="py-2 pr-4 text-neutral-400">{RLABELS[u.role] || u.role}</td>
                    <td className="py-2 pr-4 text-right text-neutral-300">{u.uploads}</td>
                    <td className="py-2 pr-4 text-right text-neutral-300">{u.downloads}</td>
                    <td className="py-2 text-neutral-400">{u.lastAction ? formatDate(u.lastAction) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === "auditoria" && (
            auditLog.length === 0
              ? <p className="text-neutral-500 text-sm py-6 text-center">No hay entradas en el log de auditoría.</p>
              : <table className="w-full text-xs">
                  <thead className="text-neutral-400 sticky top-0 bg-neutral-900">
                    <tr>
                      <th className="text-left py-2 pr-4">Fecha</th>
                      <th className="text-left py-2 pr-4">Acción</th>
                      <th className="text-left py-2 pr-4">Usuario</th>
                      <th className="text-left py-2">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLog.map((entry: any, i: number) => (
                      <tr key={i} className="border-t border-neutral-800">
                        <td className="py-2 pr-4 text-neutral-400 whitespace-nowrap">{entry.t ? formatDate(entry.t) : "—"}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${entry.action === "hard_delete" ? "bg-rose-900/40 text-rose-300 border border-rose-800/60" : "bg-amber-900/40 text-amber-300 border border-amber-800/60"}`}>
                            {entry.action === "hard_delete" ? "Eliminación" : "Reset período"}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-neutral-300">{entry.byUsername || entry.byUserId || "—"}</td>
                        <td className="py-2 text-neutral-400">{entry.details || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
        </div>
      </div>
    </div>
  );
}
