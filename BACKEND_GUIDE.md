# Guía de integración de backend — Dataflow

**Para el equipo de Cómputos**  
Versión del frontend: v8 · Preparado por: RRHH / Leonel Figuera

---

## 1. Qué es este sistema

Dataflow es una aplicación web interna para la Gerencia de RRHH.  
Tiene dos módulos principales:

| Módulo | Quién lo usa | Qué hace |
|--------|-------------|----------|
| **Información** | RRHH ↔ Sueldos | Subida, descarga y control de archivos de liquidación (CSV, TXT, Excel, ODS) |
| **Reclamos** | RRHH ↔ Sueldos | Gestión de reclamos de haberes de funcionarios con historial y notificaciones |

El frontend está desarrollado con **React 19 + TypeScript + Vite**. Actualmente funciona sin backend (todo en `localStorage` del navegador). Esta versión (v8) tiene la capa de datos abstracta y lista para conectar a un backend real.

---

## 2. Arquitectura del frontend

```
src/
├── services/
│   ├── db.ts                         ← PUNTO ÚNICO DE MIGRACIÓN
│   └── localStorage/
│       ├── filesStorage.ts           ← hoy usa localStorage
│       ├── sectorsStorage.ts         ← hoy usa localStorage
│       ├── downloadsStorage.ts       ← hoy usa localStorage
│       ├── periodsStorage.ts         ← hoy usa localStorage
│       ├── usersStorage.ts           ← hoy usa localStorage
│       ├── reclamosStorage.ts        ← hoy usa localStorage
│       └── reclamosConfigStorage.ts  ← hoy usa localStorage
├── hooks/
│   ├── useFiles.ts                   ← lógica de archivos, usa db.files.*
│   ├── useDownloads.ts               ← lógica de descargas, usa db.downloads.*
│   ├── useObservations.ts            ← lógica de dudas/arreglos
│   ├── useSectors.ts                 ← lógica de sectores/sedes, usa db.sectors.*
│   └── useReports.ts                 ← exportación CSV
└── features/reclamos/
    └── hooks/useReclamos.ts          ← lógica de reclamos, usa db.reclamos.*
```

### Cómo funciona el swap

Para migrar cualquier módulo al backend, los pasos son:

1. Crear `src/services/api/xxxAPI.ts` con las mismas funciones pero usando `fetch()`.
2. En `src/services/db.ts`, cambiar el import de `localStorage/xxxStorage` por `api/xxxAPI`.
3. El resto del código (hooks, componentes) no necesita cambios.

**Ejemplo concreto para archivos:**

```typescript
// src/services/api/filesAPI.ts  ← nuevo archivo
const API = 'https://dataflow.interna.uy/api';

export async function getAll() {
  const res = await fetch(`${API}/files`, { credentials: 'include' });
  return res.json();
}

export async function saveAll(files: any[]) {
  await fetch(`${API}/files/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(files),
  });
}
// ... resto de funciones
```

```typescript
// src/services/db.ts  ← cambiar SOLO este import
// Antes:
import * as filesStorage from './localStorage/filesStorage';
// Después:
import * as filesStorage from './api/filesAPI';
// No cambia nada más.
```

---

## 3. Stack recomendado para el backend

| Componente | Recomendación | Alternativa |
|---|---|---|
| **Lenguaje/Framework** | Node.js + Express | PHP + Laravel |
| **Base de datos** | PostgreSQL | MySQL / MariaDB |
| **Autenticación** | LDAP/Active Directory corporativo | JWT propio |
| **Servidor web** | nginx (proxy reverso) | Apache |
| **Sistema operativo** | Ubuntu Server 22.04 LTS | Debian 12 |
| **Almacenamiento de archivos** | Sistema de archivos local + nginx | MinIO (S3-compatible) |

---

## 4. Modelos de datos

### 4.1 Usuarios (`users`)

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) UNIQUE NOT NULL,
  display_name  VARCHAR(200),
  email         VARCHAR(200),
  role          VARCHAR(20) NOT NULL CHECK (role IN ('rrhh','sueldos','admin','superadmin')),
  password_hash VARCHAR(64),           -- SHA-256, solo si no usa AD/LDAP
  must_change_password BOOLEAN DEFAULT FALSE,
  range_start   INTEGER,               -- rango numérico Sueldos (inicio)
  range_end     INTEGER,               -- rango numérico Sueldos (fin)
  range_txt_start INTEGER,             -- rango TXT inicio
  range_txt_end   INTEGER,             -- rango TXT fin
  active        BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Roles:**
- `rrhh` — sube archivos, responde dudas
- `sueldos` — descarga archivos, genera dudas, tiene rango numérico exclusivo
- `admin` — gestión de usuarios, períodos, sectores
- `superadmin` — todo lo anterior + hard delete, reset de liquidaciones, bloqueo de períodos

---

### 4.2 Liquidaciones (`periods`)

```sql
CREATE TABLE periods (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,     -- Ej: "Enero 2026"
  year        INTEGER NOT NULL,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  upload_from DATE,                      -- desde cuándo puede subir RRHH
  upload_to   DATE,                      -- hasta cuándo puede subir RRHH
  locked      BOOLEAN DEFAULT FALSE,     -- solo superadmin puede cambiar
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(year, month)
);
```

---

### 4.3 Archivos (`files`)

Este es el modelo central del módulo Información.

```sql
CREATE TABLE files (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID REFERENCES periods(id) ON DELETE CASCADE,
  name            VARCHAR(500) NOT NULL,
  size            BIGINT NOT NULL,              -- bytes
  mime_type       VARCHAR(200),
  status          VARCHAR(50) DEFAULT 'cargado',
  status_override VARCHAR(50),                  -- forzado por admin
  sector          VARCHAR(200),
  site_code       VARCHAR(50),
  uploader_id     UUID REFERENCES users(id),
  uploader_name   VARCHAR(200),
  version         INTEGER DEFAULT 1,
  parent_id       UUID REFERENCES files(id),    -- versión anterior
  storage_path    VARCHAR(500),                 -- ruta en disco/S3
  eliminated      BOOLEAN DEFAULT FALSE,        -- soft delete
  eliminated_by   UUID REFERENCES users(id),
  eliminated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Estados posibles del archivo (`status`):**

| Key | Label | Descripción |
|-----|-------|-------------|
| `cargado` | Enviado | Subido por RRHH, no descargado |
| `observado` | Observado | Sueldos marcó dudas |
| `duda_respondida` | Duda respondida | RRHH contestó las dudas |
| `descargado` | Descargado | Sueldos descargó el archivo |
| `actualizado` | Actualizado | RRHH subió una versión nueva |
| `sustituido` | Sustituido | Archivo reemplazado por otro |
| `eliminado` | Eliminado | Admin eliminó lógicamente |

---

### 4.4 Historial de archivos (`file_history`)

```sql
CREATE TABLE file_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID REFERENCES files(id) ON DELETE CASCADE,
  action      VARCHAR(100) NOT NULL,   -- "subida", "descarga", "estado_cambiado", etc.
  by_user_id  UUID REFERENCES users(id),
  by_username VARCHAR(200),
  details     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.5 Observaciones / Dudas (`observation_threads`)

```sql
CREATE TABLE observation_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     UUID REFERENCES files(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('duda','arreglo')),
  by_user_id  UUID REFERENCES users(id),
  by_username VARCHAR(200),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE observation_rows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID REFERENCES observation_threads(id) ON DELETE CASCADE,
  nro         VARCHAR(20),
  nombre      VARCHAR(200),
  duda        TEXT,
  sector      VARCHAR(200),
  cc          VARCHAR(100),
  answered    BOOLEAN DEFAULT FALSE,
  answer_text TEXT,
  answered_by_user_id UUID REFERENCES users(id),
  answered_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4.6 Sectores (`sectors`) y Sedes (`sites`)

```sql
CREATE TABLE sites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(50) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL
);

CREATE TABLE sectors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(200) NOT NULL,
  patterns        TEXT[],              -- patrones de detección de nombre de archivo
  site_code       VARCHAR(50) REFERENCES sites(code),
  owner_user_id   UUID REFERENCES users(id),
  owner_username  VARCHAR(200),
  cc              VARCHAR(100),        -- centro de costo
  required        BOOLEAN DEFAULT FALSE,
  allow_no_news   BOOLEAN DEFAULT FALSE,
  active          BOOLEAN DEFAULT TRUE
);
```

---

### 4.7 Reclamos (`reclamos`)

```sql
CREATE TABLE reclamos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket             VARCHAR(30) UNIQUE NOT NULL,  -- RC-YYYYMMDD-XXXX
  nro_funcionario    VARCHAR(20) NOT NULL,
  nombre_funcionario VARCHAR(200) NOT NULL,
  email_funcionario  VARCHAR(200),
  cargo              VARCHAR(200),
  centro_costo       VARCHAR(100),
  liquidacion        VARCHAR(100),
  para_liquidacion   VARCHAR(100),
  causal             VARCHAR(200),
  tipo_reclamo       VARCHAR(200),
  descripcion        TEXT,
  emisor_id          UUID REFERENCES users(id),
  emisor_nombre      VARCHAR(200),
  estado             VARCHAR(50) DEFAULT 'Emitido'
    CHECK (estado IN ('Emitido','En proceso','Procesado/Liquidado','Rechazado','Eliminado')),
  eliminado          BOOLEAN DEFAULT FALSE,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reclamo_historial (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamo_id      UUID REFERENCES reclamos(id) ON DELETE CASCADE,
  estado          VARCHAR(50) NOT NULL,
  usuario_id      UUID REFERENCES users(id),
  usuario_nombre  VARCHAR(200),
  nota            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reclamo_notas_internas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamo_id    UUID REFERENCES reclamos(id) ON DELETE CASCADE,
  texto         TEXT NOT NULL,
  autor_id      UUID REFERENCES users(id),
  autor_nombre  VARCHAR(200),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Endpoints de API necesarios

### Convenciones

- Base URL: `/api`
- Autenticación: cookie de sesión `HttpOnly` o header `Authorization: Bearer <token>`
- Formato: JSON
- Todos los endpoints requieren usuario autenticado salvo `/api/auth/login`

---

### 5.1 Autenticación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Login con usuario/contraseña (o LDAP) |
| `POST` | `/api/auth/logout` | Cerrar sesión |
| `GET`  | `/api/auth/me` | Devuelve usuario de la sesión actual |

**POST /api/auth/login — body:**
```json
{ "username": "juan", "password": "pass123" }
```

**POST /api/auth/login — response:**
```json
{
  "id": "uuid",
  "username": "juan",
  "displayName": "Juan García",
  "role": "rrhh",
  "email": "juan@empresa.com"
}
```

---

### 5.2 Usuarios

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/users` | admin, superadmin | Lista todos los usuarios |
| `POST`   | `/api/users` | admin, superadmin | Crear usuario |
| `PUT`    | `/api/users/:id` | admin, superadmin, (propio perfil) | Actualizar usuario |
| `DELETE` | `/api/users/:id` | superadmin | Desactivar usuario |

---

### 5.3 Liquidaciones (Períodos)

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/periods` | todos | Lista liquidaciones |
| `POST`   | `/api/periods` | admin, superadmin | Crear liquidación |
| `PUT`    | `/api/periods/:id` | admin, superadmin | Actualizar fechas/bloqueo |
| `DELETE` | `/api/periods/:id` | admin (solo sin archivos) | Eliminar liquidación |

**Nota importante:** El campo `locked` solo puede ser modificado por `superadmin`.

---

### 5.4 Archivos — Módulo Información ⭐ (prioridad)

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/files` | todos | Lista archivos (filtrar por `periodId`) |
| `POST`   | `/api/files/upload` | rrhh, admin | Subir archivo (multipart/form-data) |
| `GET`    | `/api/files/:id/download` | sueldos, admin, superadmin | Descargar archivo |
| `PUT`    | `/api/files/:id/status` | sueldos, admin | Cambiar estado |
| `PUT`    | `/api/files/:id` | admin | Actualizar metadatos |
| `DELETE` | `/api/files/:id` | admin (soft), superadmin (hard) | Eliminar archivo |
| `POST`   | `/api/files/:id/version` | rrhh, admin | Subir nueva versión |
| `GET`    | `/api/files/:id/history` | todos | Historial del archivo |

**POST /api/files/upload — multipart fields:**
```
file: <archivo binario>
periodId: "uuid-liquidacion"
sector: "Emergencia"
siteCode: "SEDE01"
```

**Response de un archivo:**
```json
{
  "id": "uuid",
  "name": "liquidacion-enero.csv",
  "size": 45320,
  "status": "cargado",
  "sector": "Emergencia",
  "siteCode": "SEDE01",
  "uploaderName": "Juan García",
  "periodId": "uuid",
  "version": 1,
  "createdAt": "2026-04-01T14:30:00Z"
}
```

---

### 5.5 Observaciones / Dudas

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/files/:id/observations` | todos | Lista dudas/arreglos del archivo |
| `POST`   | `/api/files/:id/observations` | sueldos, admin | Crear duda |
| `POST`   | `/api/files/:id/adjustments` | sueldos, admin | Crear arreglo |
| `PUT`    | `/api/observations/:threadId/rows/:rowId/answer` | rrhh, admin | Responder duda |
| `PUT`    | `/api/observations/:threadId/processed` | sueldos, admin | Marcar hilo procesado |

---

### 5.6 Descargas y contadores de numeración

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/downloads/counters` | sueldos | Obtiene contadores de numeración del usuario actual |
| `PUT`    | `/api/downloads/counters` | sueldos | Actualiza contador para un período |
| `GET`    | `/api/downloads/logs` | admin, superadmin | Historial de descargas |

**Importante — contadores de numeración:**  
Cada usuario de Sueldos tiene un rango numérico exclusivo (ej: del 1 al 100). El sistema numera los archivos al descargar. En backend, este contador debe ser **atómico** para evitar duplicados si dos usuarios descargan al mismo tiempo.

```sql
-- Incremento atómico recomendado en PostgreSQL:
UPDATE download_counters
SET current = current + 1
WHERE user_id = $1 AND period_id = $2
RETURNING current;
```

---

### 5.7 Sectores y Sedes

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/sectors` | todos | Lista sectores activos |
| `POST`   | `/api/sectors` | admin, superadmin | Crear sector |
| `PUT`    | `/api/sectors/:id` | admin, superadmin | Actualizar sector |
| `DELETE` | `/api/sectors/:id` | admin, superadmin | Desactivar sector |
| `GET`    | `/api/sites` | todos | Lista sedes |
| `POST`   | `/api/sites` | admin, superadmin | Crear sede |
| `PUT`    | `/api/sites/:code` | admin, superadmin | Actualizar sede |

---

### 5.8 Reclamos

| Método | Ruta | Quién puede | Descripción |
|--------|------|-------------|-------------|
| `GET`    | `/api/reclamos` | rrhh, sueldos, admin | Lista reclamos (con filtros) |
| `GET`    | `/api/reclamos/:id` | todos | Detalle de un reclamo |
| `POST`   | `/api/reclamos` | rrhh, admin | Crear reclamo |
| `PUT`    | `/api/reclamos/:id/estado` | sueldos, admin | Cambiar estado |
| `DELETE` | `/api/reclamos/:id` | rrhh, admin | Eliminación lógica |
| `GET`    | `/api/reclamos/:id/historial` | todos | Historial de estados |
| `POST`   | `/api/reclamos/:id/notas` | rrhh, sueldos, admin | Agregar nota interna |
| `GET`    | `/api/reclamos/config` | admin, superadmin | Config del módulo |
| `PUT`    | `/api/reclamos/config` | admin, superadmin | Guardar config |

---

## 6. Autenticación con Active Directory / LDAP

Si la empresa tiene Active Directory, el login puede conectarse directamente.

**Flujo recomendado:**
1. Usuario ingresa usuario/contraseña en la app
2. Frontend hace `POST /api/auth/login`
3. Backend valida credenciales contra LDAP/AD corporativo
4. Si es válido, crea sesión (cookie HttpOnly con JWT o session ID)
5. Frontend usa la cookie en todas las llamadas siguientes

**En el frontend solo hay que cambiar:**

```typescript
// src/lib/auth.ts — función attemptLogin()
// Antes (hash local):
export async function attemptLogin(username, password) {
  const hash = await sha256(password);
  const users = loadUsers();
  return users.find(u => u.username === username && u.passwordHash === hash);
}

// Después (API):
export async function attemptLogin(username, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;
  return res.json();  // devuelve { id, username, displayName, role, ... }
}
```

**Librería recomendada para Node.js + LDAP:**
```bash
npm install ldapjs
# o
npm install passport passport-ldapauth
```

---

## 7. Almacenamiento de archivos

Los archivos binarios (CSV, TXT, Excel, ODS) necesitan almacenamiento persistente.

**Opción recomendada: sistema de archivos local con nginx**

```
/var/dataflow/
  uploads/
    {periodId}/
      {fileId}_{nombre_original}
```

```nginx
# nginx — servir archivos protegidos (requiere auth previa)
location /files-privados/ {
  internal;
  alias /var/dataflow/uploads/;
}
```

El backend usa `X-Accel-Redirect` para que nginx sirva el archivo directamente sin pasar por Node.js, protegiéndolo con la sesión del usuario.

**En Node.js/Express:**
```javascript
app.get('/api/files/:id/download', requireAuth, async (req, res) => {
  const file = await db.query('SELECT * FROM files WHERE id = $1', [req.params.id]);
  if (!file) return res.status(404).send('No encontrado');
  
  // nginx sirve el archivo directo (eficiente)
  res.setHeader('X-Accel-Redirect', `/files-privados/${file.storage_path}`);
  res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
  res.send();
});
```

---

## 8. Cómo conectar el frontend paso a paso

### Paso 1 — Crear archivo de configuración

```typescript
// src/services/api/config.ts
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
```

```env
# .env.production
VITE_API_URL=https://dataflow.interna.uy/api
```

### Paso 2 — Crear helper de fetch con manejo de errores

```typescript
// src/services/api/client.ts
import { API_BASE } from './config';

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 401) {
    // Sesión expirada — redirigir a login
    window.location.reload();
    return null;
  }
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
```

### Paso 3 — Implementar filesAPI.ts (módulo Información)

```typescript
// src/services/api/filesAPI.ts
import { apiFetch } from './client';

export async function getAll() {
  return apiFetch('/files');
}

export async function saveAll(files: any[]) {
  // En backend real, los archivos se guardan individualmente.
  // Este método se usa internamente para sincronizar el estado local.
  // Para una migración incremental puede dejarse como no-op
  // y usar los endpoints individuales (upload, updateStatus, etc.)
}

export async function getAuditLog() {
  return apiFetch('/files/audit');
}

export async function saveAuditLog(_log: any[]) {
  // El audit log en backend se escribe desde el servidor, no desde el cliente
}

export async function appendAuditEntry(_entry: any) {
  // No-op: el backend escribe el audit automáticamente en cada operación
}
```

### Paso 4 — Actualizar db.ts

```typescript
// src/services/db.ts
// Cambiar SOLO los imports de localStorage a api:

// Antes:
import * as filesStorage from './localStorage/filesStorage';
// Después:
import * as filesStorage from './api/filesAPI';
```

### Paso 5 — Actualizar login

En `src/lib/auth.ts`, reemplazar `attemptLogin()` para que llame a `POST /api/auth/login`.

### Paso 6 — Probar módulo por módulo

Orden recomendado:
1. ✅ Autenticación (login/logout)
2. ✅ Liquidaciones (períodos)
3. ✅ Archivos (subida, listado, descarga)
4. ✅ Sectores y sedes
5. ✅ Observaciones/Dudas
6. ✅ Usuarios (admin)
7. ✅ Reclamos

---

## 9. Checklist mínimo para primera versión funcional

- [ ] Servidor Ubuntu con Node.js 20+ y PostgreSQL 15+
- [ ] nginx configurado como proxy reverso en el puerto 443 (HTTPS)
- [ ] Esquema de base de datos creado (tablas del punto 4)
- [ ] Endpoint `POST /api/auth/login` funcionando (con o sin LDAP)
- [ ] Endpoint `GET /api/auth/me` funcionando
- [ ] Endpoint `GET /api/periods` y `POST /api/periods`
- [ ] Endpoint `POST /api/files/upload` (subida de archivos)
- [ ] Endpoint `GET /api/files?periodId=xxx` (listado por período)
- [ ] Endpoint `GET /api/files/:id/download` (descarga)
- [ ] Carpeta `/var/dataflow/uploads/` con permisos de escritura
- [ ] CORS configurado para aceptar el dominio del frontend
- [ ] Variable de entorno `VITE_API_URL` apuntando al backend

---

## 10. Notas adicionales

### CORS
```javascript
// Express — configurar CORS para el frontend
app.use(cors({
  origin: 'https://dataflow.interna.uy',  // dominio del frontend
  credentials: true,                       // necesario para cookies
}));
```

### Seguridad de sesión
```javascript
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,   // protege contra XSS
    secure: true,     // solo HTTPS
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,  // 8 horas
  },
}));
```

### Variables de entorno del backend
```env
# .env del servidor backend
DATABASE_URL=postgresql://dataflow_user:pass@localhost:5432/dataflow
SESSION_SECRET=clave-larga-y-aleatoria-aqui
UPLOAD_DIR=/var/dataflow/uploads
LDAP_URL=ldap://ad.empresa.com
LDAP_BASE=dc=empresa,dc=com
PORT=3000
```

---

*Ante cualquier duda sobre la arquitectura del frontend, consultar a Leonel Figuera (RRHH).*
