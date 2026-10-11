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
├── api/                    # Endpoints PHP (JSON)
│   ├── _lib/               # Nucleo: bootstrap, db, auth
│   ├── login.php  logout.php  session.php
│   ├── dashboard.php  pacientes.php  historia.php
│   ├── imagenes.php  citas.php  reportes.php  medicos.php
├── public/                 # Frontend (se sirve como raiz estatica)
│   ├── index.html          # Login
│   ├── dashboard.html  pacientes.html  historia.html
│   ├── citas.html  reportes.html  perfil.html  usuarios.html
│   ├── imprimir.html       # Vista de impresion / PDF
│   ├── assets/css/app.css  assets/js/*.js
│   └── uploads/logos|imagenes
├── db/
│   ├── schema.sql          # Esquema completo
│   └── setup.php           # Aplica esquema + datos demo
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

### GitHub

```bash
git init
git add .
git commit -m "Historia clinica ginecologica - v1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/gineco.git
git push -u origin main
```

El archivo `.env` esta en `.gitignore` (nunca se sube). Sube `.env.example`.

### Hosting PHP (produccion recomendada)

Cualquier hosting con PHP 8.1+ y PostgreSQL sirve el sistema tal cual:

1. Sube todos los archivos (Ruta de la app = carpeta del proyecto).
2. Crea `.env` con los datos de Neon (`DB_SSLMODE=require`).
3. Aplica `db/schema.sql` a Neon (panel de Neon o `psql`).
4. Asegura que `public/uploads/` sea escribible (755/775).
5. Punto de entrada publico: `/public/index.html`.

Proveedores con PHP + PostgreSQL: **Railway**, **Render**, **A2 Hosting**, **cPanel**,
**InfinityFree**, o un VPS con Nginx/Apache.

### Vercel

Vercel sirve hoy proyectos **estaticos y serverless en Node/Python/Go**, pero **no ejecuta
PHP**. Por eso el repositorio esta separado de forma que puedas:

* Publicar el frontend (`public/`) como sitio estatico en Vercel, y
* Hospedar `api/` en cualquier servicio con PHP + PostgreSQL (los endpoints ya estan
  escritos como archivos autocontenidos tipo funcion serverless).

Si todo debe vivir en Vercel, habra que migrar `api/` a un runtime soportado (el esquema
SQL y el frontend no cambian).

Para probar el frontend en Vercel:

1. Repo en GitHub con esta estructura.
2. Nuevo proyecto -> Framework: **Other**, **Output Directory:** `public`.
3. Configura las variables de entorno si usas funciones en otro servicio.

---

## 7. Solucion de problemas

| Problema | Solucion |
|----------|----------|
| `La extension pdo_pgsql no esta habilitada` | Descomenta `extension=pdo_pgsql` en `php.ini` y reinicia Apache |
| `No se pudo conectar a la base de datos` | Revisa `DB_*` en `.env`; en Neon usa `DB_SSLMODE=require` |
| Imagenes no se guardan | Permisos de escritura en `public/uploads/` o cambia a `UPLOAD_MODE=db` |
| Estilos/logos no cargan en produccion | Verifica `APP_URL` y que el frontend apunte a `/public` |
| Errores 401 al recargar | Las sesiones usan cookies; habilita cookies en el navegador |

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
