# Historia Clinica Ginecologica

Sistema medico web multi-medico para ginecologia: historia clinica completa en 9 secciones,
agenda de citas, carga de ecografias/ultrasonidos, buscador de pacientes y reportes.
Diseño clinico elegante en rosa / blanco / gris, sin frameworks pesados.

---

## Stack

| Capa      | Tecnologia                                   |
|-----------|----------------------------------------------|
| Frontend  | HTML5, CSS3, JavaScript (vanilla)            |
| Backend   | PHP 8+ (API JSON, sesiones por cookie)       |
| Base de datos | PostgreSQL (Neon serverless o local)     |
| Fuente    | Inter / Poppins (Google Fonts)               |

## Estructura del repositorio

```
gineco/
├── api/                    # Endpoints PHP (JSON) = funciones de Vercel
│   ├── login.php  logout.php  session.php
│   ├── dashboard.php  pacientes.php  historia.php
│   ├── imagenes.php  citas.php  reportes.php  medicos.php
│   └── php.ini             # Config PHP solo para el despliegue
├── lib/                    # Nucleo compartido: bootstrap, db, auth
├── public/                 # Frontend (se sirve como raiz estatica)
│   ├── index.html          # Login
│   ├── dashboard.html  pacientes.html  historia.html
│   ├── citas.html  reportes.html  perfil.html  usuarios.html
│   ├── imprimir.html       # Vista de impresion / PDF
│   ├── assets/css/app.css  assets/js/*.js
│   └── uploads/logos|imagenes
├── db/
│   ├── schema.sql          # Esquema completo
│   ├── setup.php           # Esquema + datos de demostracion
│   └── migrar.php          # Aplica solo el esquema (Neon/produccion)
├── vercel.json             # Config de despliegue (runtime PHP + frontend)
├── .env.example            # Plantilla de configuracion
└── README.md
```

---

## 1. Requisitos

* PHP 8.1+ con `pdo_pgsql` habilitado (XAMPP: `extension=pdo_pgsql` en `php.ini`)
* PostgreSQL 13+ — [Neon](https://neon.tech) (recomendado en produccion) o local
* Apache (XAMPP) o cualquier servidor con PHP

---

## 2. Instalacion local (XAMPP)

1. Copia la carpeta `gineco` dentro de `C:\xampp\htdocs\`.

2. Crea el archivo de configuracion:

   ```bash
   cp .env.example .env
   ```

   y completa los datos de tu base de datos:

   ```env
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=gineco
   DB_USER=postgres
   DB_PASSWORD=tu_password
   DB_SSLMODE=disable      # en Neon: require
   APP_URL=http://localhost/gineco
   UPLOAD_MODE=files
   APP_DEBUG=1
   ```

3. Crea la base de datos e instala el esquema con datos de demostracion:

   ```bash
   C:\xampp\php\php.exe db\setup.php
   ```

   > Sin datos demo: `php db/setup.php --sin-demo`
   >
   > Con Neon puedes aplicar el esquema tambien con:
   > `psql "$DATABASE_URL" -f db/schema.sql`

4. Abre **http://localhost/gineco/public/index.html**

   | Rol         | Usuario    | Contrasena  |
   |-------------|------------|-------------|
   | Superadmin  | `admin`    | `Admin123!` |
   | Medica      | `doctora`  | `Doctor123!`|
   | Medico      | `doctor`   | `Doctor123!`|

   Cambia o elimina estas cuentas antes de usar el sistema en produccion.

---

## 3. Modulos

* **Login simple** — usuario + contrasena, sesion por cookie httpOnly.
* **Dashboard** — pacientes, citas del dia, proximas citas, ultimas consultas y accesos rapidos.
* **Historia clinica ginecologica** — 9 secciones colapsables:
  1. Datos personales
  2. Antecedentes personales y patologicos
  3. Antecedentes gineco-obstetricos
  4. Examen fisico y signos vitales (IMC automatico)
  5. Examen ginecologico
  6. Paraclinicos / examenes (tabla dinamica)
  7. Imagenes / ecografias / ultrasonidos (JPG, PNG, WEBP, PDF)
  8. Diagnostico + CIE-10 + tratamiento + proxima cita
  9. Historial de consultas (linea de tiempo)
* **Citas** — calendario mensual/semanal, vista del dia, estados pendiente/atendida/cancelada.
* **Pacientes** — busqueda por nombre, cedula, N° registro o telefono (ignora acentos).
* **Reportes** — pacientes, citas y consultas por rango de fechas + resumen de diagnosticos.
* **Perfil del medico** — logo, colores institucionales, monograma y cambio de contrasena.
* **Cuentas (superadmin)** — crea, edita, activa y elimina cuentas de medicos.
* **Impresion / PDF** — `imprimir.html?c=ID` con el logo del medico; "Guardar como PDF"
  usa el dialogo de impresion del navegador (sin librerias externas).

---

## 4. Arquitectura multi-medico

* Cada usuario `medico` tiene una fila en `medicos` con su logo, colores y especialidad.
* Todos los recursos (pacientes, historias, consultas, citas, imagenes) llevan `medico_id`
  y **todas** las consultas SQL filtran por el medico de la sesion: un medico jamas ve
  datos de otro.
* El `superadmin` administra cuentas y colores; no tiene perfil clinico propio salvo que
  tambien se le cree uno.
* El color institucional se aplica en tiempo real via variables CSS (`--primary`).

---

## 5. Imagenes / ecografias

Dos modos, segun `UPLOAD_MODE` en `.env`:

* `files` (por defecto) — el archivo se guarda en `public/uploads/imagenes/`.
  Requiere disco escribible.
* `db` — el archivo se guarda en la columna `contenido` (BYTEA) de la tabla
  `imagenes_ecografias` y se sirve desde `api/imagenes.php?id=N`.
  Ideal en entornos serverless con sistema de archivos de solo lectura.

Formatos admitidos: JPG, PNG, WEBP y PDF, hasta 15 MB por archivo.

---

## 6. Despliegue

### 6.1 GitHub

Repositorio: **https://github.com/arteylogicarafa/gineco** (publico).

```bash
git add .
git commit -m "cambios"
git push origin main
```

El archivo `.env` esta en `.gitignore`/`.vercelignore` (nunca se sube).

### 6.2 Neon (base de datos)

1. Crea el proyecto en [neon.tech](https://neon.tech) y copia el **string de conexion**
   (`postgres://usuario:password@ep-xxx.aws.neon.tech/dbname?sslmode=require`).
2. Aplica el esquema con el script incluido (desde tu equipo):

   ```bash
   # .env apuntando a Neon (DB_SSLMODE=require)
   php db/migrar.php
   ```

   O pega el contenido de `db/schema.sql` en el SQL Editor de Neon.

### 6.3 Vercel (frontend + API)

Vercel no tiene runtime PHP oficial, pero este proyecto usa el runtime comunitario
[`vercel-php`](https://github.com/vercel-community/php) (PHP 8.3 con `pdo_pgsql` incluido),
configurado en `vercel.json`.

1. **Importa el repo** en [vercel.com/new](https://vercel.com/new) → proyecto `gineco`.
   * Framework Preset: **Other**
   * Build Command: *(vacio)*
   * Output Directory: **`public`**
2. **Environment Variables** (Settings → Environment Variables):

   | Variable | Valor |
   |----------|-------|
   | `DB_HOST` | host de Neon (`ep-xxx.aws.neon.tech`) |
   | `DB_PORT` | `5432` |
   | `DB_NAME` | nombre de la BD en Neon |
   | `DB_USER` | usuario de Neon |
   | `DB_PASSWORD` | password de Neon |
   | `DB_SSLMODE` | `require` |
   | `UPLOAD_MODE` | `db` |
   | `SESSION_DRIVER` | `db` |
   | `APP_DEBUG` | `0` |
   | `SESSION_NAME` | `gineco_session` |

3. Pulsa **Deploy**. La URL queda en `https://TU-PROYECTO.vercel.app`.
4. Entra con las cuentas demo y cambia sus contrasenas desde **Mi perfil**.

Detalles importantes del despliegue en Vercel:

* **`UPLOAD_MODE=db` es obligatorio**: el disco de las funciones es de solo lectura, por
  eso las ecografias van a la tabla `imagenes_ecografias` (BYTEA) y el logo medico se
  guarda embebido (data-URL) en `medicos.logo`.
* **`SESSION_DRIVER=db`**: las sesiones se guardan en la tabla `sesiones`, asi sobreviven
  a los reinicios y a las distintas instancias serverless.
* El plan Hobby admite **maximo 12 funciones** por despliegue: este proyecto usa **10**
  (los endpoints de `api/`). Si agregas endpoints nuevos, subelos a un plan de pago o
  agrupalos.
* Si cambias `db/schema.sql`, vuelve a ejecutar `php db/migrar.php` contra Neon.

### 6.4 Alternativa: hosting PHP clasico

Cualquier hosting con PHP 8.1+ y PostgreSQL funciona igual (XAMPP, cPanel, Railway, Render):

1. Sube todos los archivos; DocumentRoot o subcarpeta publica = `public/`.
2. Crea `.env` con los datos de Neon (`DB_SSLMODE=require`) y ejecuta `php db/migrar.php`.
3. Con `UPLOAD_MODE=files` las imagenes se guardan en `public/uploads/` (debe ser
   escribible) y las sesiones pueden ir a ficheros (`SESSION_DRIVER=file`).

---

## 7. Solucion de problemas

| Problema | Solucion |
|----------|----------|
| `La extension pdo_pgsql no esta habilitada` | Descomenta `extension=pdo_pgsql` en `php.ini` y reinicia Apache |
| `No se pudo conectar a la base de datos` | Revisa `DB_*` en `.env`; en Neon usa `DB_SSLMODE=require` |
| Imagenes no se guardan | Permisos de escritura en `public/uploads/` o cambia a `UPLOAD_MODE=db` |
| Estilos/logos no cargan en produccion | Verifica `APP_URL` y que el frontend apunte a `/public` |
| Errores 401 al recargar | Las sesiones usan cookies; habilita cookies en el navegador |
| elation "sesiones" does not exist | Ejecuta `php db/migrar.php` contra la BD configurada |
| En Vercel dice que el disco es de solo lectura | Usa `UPLOAD_MODE=db` y `SESSION_DRIVER=db` |
| No more than 12 functions en Vercel Hobby | Agrupa endpoints o sube de plan (hay 10 funciones) |

---

## 8. Seguridad

* Contrasenas con `password_hash()` (bcrypt).
* Cookie de sesion `HttpOnly` + `SameSite=Lax` (+ `Secure` cuando corre en HTTPS).
* Token CSRF (`X-CSRF-Token`) en toda operacion POST/PUT/DELETE.
* Consultas SQL siempre preparadas (sin concatenar valores).
* Filtrado obligatorio por `medico_id` en cada recurso.
* Limites de tamaño y tipo MIME en la subida de archivos.

---

## 9. Pruebas

```bash
php db/setup.php                       # esquema + datos demo
# API: login, CRUD, aislamiento multi-medico, reportes, subida de imagenes
# Interfaz: carga de cada pantalla sin errores de JavaScript
```
