# Dataflow — Contexto del proyecto para Claude Code

## Qué es esto
App web interna para la Gerencia de RRHH de una mutual uruguaya.
Coordina el intercambio de archivos entre el equipo de **Información/RRHH** y el equipo de **Sueldos**, y gestiona reclamos de haberes de funcionarios.
Frontend-only SPA. Sin backend todavía — todo en `localStorage` via capa de abstracción `services/db.ts`.

## Stack
- React 19 + TypeScript + Vite 7
- Tailwind CSS via CDN (en `index.html`, no como paquete npm)
- Sin librerías de estado externas (solo useState/useMemo)
- `// @ts-nocheck` en la mayoría de archivos — intencional, no tocar

## Cómo correr
```bash
npm install
npm run dev        # desarrollo en localhost:5173
npm run build      # build de producción
```

Login inicial: `admin / Admin-1234` · `superadmin / Super-1234`

## Arquitectura
```
src/
├── app/DataFlowDemo.tsx          ← componente raíz (~2.817 líneas)
├── hooks/
│   ├── useFiles.ts               ← archivos: upload, delete (lógico/físico), status, history
│   ├── useDownloads.ts           ← descarga + numeración Sueldos + ZIP
│   ├── useObservations.ts        ← dudas, arreglos, respuestas
│   ├── useReports.ts             ← exportación CSV
│   └── useSectors.ts             ← sectores, sedes, CSV import/export
├── features/
│   ├── files/                    ← tabla, detalle, modales de archivo
│   ├── observations/             ← dudas funcionario (ObserveModal), arreglos, respuestas
│   ├── doubts/                   ← (en desarrollo)
│   ├── reclamos/                 ← módulo completo de reclamos de haberes ← NUEVO en v5
│   │   ├── components/           ← ReclamosPanel, TablaReclamos, FormularioReclamo,
│   │   │                            DetalleReclamo, ReclamosConfig, ReportesReclamos
│   │   ├── hooks/                ← useReclamos, useReclamosConfig, useNotificaciones
│   │   └── types/                ← reclamo.types.ts (EstadoReclamo, Reclamo, etc.)
│   ├── sectors/                  ← gestión sectores/sedes+CC, resumen por sector
│   ├── periods/                  ← liquidaciones (con bloqueo por superadmin)
│   ├── reports/                  ← modales exportación CSV
│   └── users/                    ← admin usuarios, permisos, perfil, SuperadminDashboard
├── services/                     ← NUEVO en v5: capa de abstracción de persistencia
│   ├── db.ts                     ← punto de migración: swappear implementación para backend real
│   └── localStorage/
│       ├── reclamosStorage.ts    ← CRUD reclamos en localStorage
│       └── reclamosConfigStorage.ts ← config de reclamos (causales, tipos, etc.)
├── components/                   ← componentes UI genéricos
└── lib/
    ├── auth.ts                   ← login, sesión, usuarios (PUNTO DE MIGRACIÓN a AD/LDAP)
    ├── perms.ts                  ← permisos por rol (incluye superadmin)
    ├── storage.ts                ← claves de localStorage
    ├── time.ts / bytes.ts / ids.ts / cls.ts
    └── types.ts (vacío, tipos en src/types.ts)
```

## Roles del sistema
- **superadmin** — por encima de todo: hard delete archivos, reset liquidaciones (con contraseña), dashboard SA, backup completo, bloqueo de períodos
- **admin** — gestión total: usuarios, períodos, sectores, sedes, permisos; borrado lógico de archivos
- **rrhh** (Información) — sube archivos, responde dudas, crea arreglos
- **sueldos** — descarga archivos, marca dudas, recibe numeración automática

## Persistencia actual (localStorage)
- `useFiles` → `fileflow-demo-v1`
- `useDownloads` → `dataflow-downloadCounters`, `dataflow-downloadedFiles`, `dataflow-downloadLogs`
- `useSectors` → `dataflow-sectors-v1`, `fileflow-sites-v1`
- `reclamos` → via `services/db.ts` → `reclamosStorage` / `reclamosConfigStorage`
- Audit log superadmin → `dataflow-audit-log-v1`

## Sectores
- Cada sector tiene: nombre, patrones de detección, sede (siteCode), responsable RRHH (ownerUserId/ownerUsername), centro de costo (cc), requeridos, allowNoNews, activo
- CSV import acepta columnas: `sector, patrones, sede, responsable, requeridos, sin_novedades, activo, cc`
- El CC del sector auto-popula el campo CC en el modal de dudas (ObserveModal)

## Módulo Reclamos (NUEVO v5)
- Ticket con formato `RC-YYYYMMDD-XXXX`
- Estados: Emitido → En proceso → Procesado/Liquidado / Rechazado / Eliminado
- Historial de estados con usuario y fecha
- Notificaciones simuladas (email/whatsapp) con HTML
- Configurable: causales, tipos de reclamo
- Reportes propios

## Migración futura a backend (Linux + Apache + PostgreSQL + LDAP)
- **Login**: reemplazar `attemptLogin()` en `src/lib/auth.ts`
- **Datos**: reemplazar implementación en `services/db.ts` — el resto del código no cambia
- **Archivos**: los blobUrl son temporales en memoria — necesitan S3 o equivalente

## Convenciones importantes
- `// @ts-nocheck` en casi todos los archivos — NO agregar tipos estrictos salvo que ya existan
- Inicialización de hooks: los `const [estado]` deben definirse ANTES del hook que los usa
- Los modales en `features/` reciben todo por props — no acceden a estado global directamente
- `useSectors` y `useFiles` inicializan y persisten su propio estado

## Estado actual (Marzo 2026)
- Build limpio ✅ (90 módulos)
- v3/v4: barra de progreso de entrega, superadmin, logs de auditoría, bloqueo de períodos, backup, dashboard SA, CC en sectores, rediseño ObserveModal
- v5: módulo Reclamos completo, capa `services/db.ts`, carpeta `features/doubts` (en desarrollo)
