-- =============================================================
--  Historia Clinica Ginecologica - Esquema PostgreSQL
--  Compatible con: Neon (serverless), PostgreSQL 13+
--  Ejecutar: psql "$DATABASE_URL" -f db/schema.sql
--            o bien: php db/setup.php
-- =============================================================

BEGIN;

-- ---------------------------------------------------------------
-- Usuarios (autenticacion)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id             BIGSERIAL PRIMARY KEY,
  usuario        VARCHAR(60)  NOT NULL UNIQUE,
  email          VARCHAR(160) UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  nombre         VARCHAR(160) NOT NULL,
  rol            VARCHAR(20)  NOT NULL DEFAULT 'medico'
                 CHECK (rol IN ('superadmin','medico')),
  activo         BOOLEAN      NOT NULL DEFAULT TRUE,
  ultimo_acceso  TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Medicos (perfil institucional: logo, colores, datos de cabecera)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medicos (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT      NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre            VARCHAR(160) NOT NULL,
  especialidad      VARCHAR(160) DEFAULT 'Ginecologia y Obstetricia',
  colegiatura       VARCHAR(80),
  direccion         VARCHAR(255),
  telefono          VARCHAR(40),
  correo            VARCHAR(160),
  logo              TEXT,        -- ruta relativa o data-URL (UPLOAD_MODE=db)
  color_primario    VARCHAR(20)  NOT NULL DEFAULT '#C2185B',
  color_secundario  VARCHAR(20)  NOT NULL DEFAULT '#F06292',
  monograma         VARCHAR(6),
  creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------
-- Pacientes
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pacientes (
  id                BIGSERIAL PRIMARY KEY,
  medico_id         BIGINT      NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  registro_numero   VARCHAR(30),
  nombre            VARCHAR(160) NOT NULL,
  cedula            VARCHAR(40),
  fecha_nacimiento  DATE,
  edad              SMALLINT,
  sexo              VARCHAR(12) DEFAULT 'Femenino',
  procedencia       VARCHAR(120),
  ocupacion         VARCHAR(120),
  estado_civil      VARCHAR(30),
  telefono          VARCHAR(40),
  correo            VARCHAR(160),
  direccion         VARCHAR(255),
  alergias_conocidas VARCHAR(255),
  notas             TEXT,
  creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pacientes_medico  ON pacientes(medico_id);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre  ON pacientes(medico_id, nombre);
CREATE INDEX IF NOT EXISTS idx_pacientes_cedula  ON pacientes(medico_id, cedula);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pacientes_cedula
  ON pacientes(medico_id, cedula) WHERE cedula IS NOT NULL AND cedula <> '';

-- ---------------------------------------------------------------
-- Historias clinicas (una por paciente, contiene N de registro)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historias_clinicas (
  id             BIGSERIAL PRIMARY KEY,
  paciente_id    BIGINT      NOT NULL UNIQUE REFERENCES pacientes(id) ON DELETE CASCADE,
  medico_id      BIGINT      NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  numero         VARCHAR(30),
  fecha_apertura DATE        NOT NULL DEFAULT CURRENT_DATE,
  estado         VARCHAR(20) NOT NULL DEFAULT 'activa',
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historias_medico ON historias_clinicas(medico_id);

-- ---------------------------------------------------------------
-- Consultas (cada visita / atencion de la historia)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS consultas (
  id               BIGSERIAL PRIMARY KEY,
  historia_id      BIGINT      NOT NULL REFERENCES historias_clinicas(id) ON DELETE CASCADE,
  medico_id        BIGINT      NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  numero           SMALLINT    NOT NULL DEFAULT 1,
  fecha_consulta   DATE        NOT NULL DEFAULT CURRENT_DATE,
  hora             TIME,
  motivo_consulta  TEXT,
  diagnostico      TEXT,
  cie10            VARCHAR(20),
  tratamiento      TEXT,
  proxima_cita     DATE,
  notas            TEXT,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (historia_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_consultas_historia ON consultas(historia_id);
CREATE INDEX IF NOT EXISTS idx_consultas_medico   ON consultas(medico_id, fecha_consulta);

-- ---------------------------------------------------------------
-- Seccion 2: Antecedentes personales, patologicos y familiares
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS antecedentes_personales (
  consulta_id       BIGINT PRIMARY KEY REFERENCES consultas(id) ON DELETE CASCADE,
  hta               BOOLEAN     DEFAULT FALSE,
  dm                VARCHAR(10) DEFAULT 'No',          -- No / DM1 / DM2
  tiroides          BOOLEAN     DEFAULT FALSE,
  tiroides_detalle  VARCHAR(160),
  asma              BOOLEAN     DEFAULT FALSE,
  insulina          BOOLEAN     DEFAULT FALSE,
  alergia           BOOLEAN     DEFAULT FALSE,
  alergia_detalle   VARCHAR(255),
  quirurgicos       TEXT,
  otros             TEXT,
  familiares        TEXT,
  oncologicos       TEXT,
  fumador           VARCHAR(20) DEFAULT 'No',
  alcohol           VARCHAR(20) DEFAULT 'No',
  ITS               VARCHAR(20) DEFAULT 'No'
);

-- ---------------------------------------------------------------
-- Seccion 3: Antecedentes gineco-obstetricos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secciones_gineco (
  consulta_id       BIGINT PRIMARY KEY REFERENCES consultas(id) ON DELETE CASCADE,
  menarquia         SMALLINT,
  menopausia        VARCHAR(60),
  trh               VARCHAR(120),
  ciclos            VARCHAR(20) DEFAULT 'Regulares',   -- Regulares / Irregulares / Amenorrea
  ciclo_duracion    VARCHAR(40),
  sangrado          VARCHAR(60),
  premenstrual      VARCHAR(120),
  lactancia         VARCHAR(40),
  fuc               DATE,
  mac               VARCHAR(80),
  esterilizacion    VARCHAR(80),
  gestas            SMALLINT    DEFAULT 0,
  partos            SMALLINT    DEFAULT 0,
  cesareas          SMALLINT    DEFAULT 0,
  abortos           SMALLINT    DEFAULT 0,
  legrados          SMALLINT    DEFAULT 0,
  histerectomias    SMALLINT    DEFAULT 0,
  complicaciones    TEXT
);

-- ---------------------------------------------------------------
-- Seccion 4: Examen fisico y signos vitales
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS examenes_fisicos (
  consulta_id       BIGINT PRIMARY KEY REFERENCES consultas(id) ON DELETE CASCADE,
  pa_sistolica      SMALLINT,
  pa_diastolica     SMALLINT,
  fc                SMALLINT,
  temp              NUMERIC(4,1),
  peso              NUMERIC(5,2),
  talla             NUMERIC(5,2),
  imc               NUMERIC(5,2),
  saturacion        SMALLINT,
  sintomas          TEXT,
  aspecto_general   VARCHAR(255),
  mamas             VARCHAR(255),
  cuello_tiroides   VARCHAR(255),
  cuello_ganglios   VARCHAR(255),
  abdomen           VARCHAR(255),
  extremidades      VARCHAR(255)
);

-- ---------------------------------------------------------------
-- Seccion 5: Examen ginecologico
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS examenes_ginecologicos (
  consulta_id       BIGINT PRIMARY KEY REFERENCES consultas(id) ON DELETE CASCADE,
  genitales_externos VARCHAR(255),
  vagina            VARCHAR(255),
  cervix            VARCHAR(255),
  utero             VARCHAR(255),
  anexos            VARCHAR(255),
  fondo_saco        VARCHAR(255),
  citologia         VARCHAR(255)
);

-- ---------------------------------------------------------------
-- Seccion 6: Paraclinicos / examenes auxiliares
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS paraclinicos (
  id            BIGSERIAL PRIMARY KEY,
  consulta_id   BIGINT      NOT NULL REFERENCES consultas(id) ON DELETE CASCADE,
  nombre        VARCHAR(180) NOT NULL,
  fecha         DATE,
  resultado     TEXT,
  observaciones TEXT
);
CREATE INDEX IF NOT EXISTS idx_paraclinicos_consulta ON paraclinicos(consulta_id);

-- ---------------------------------------------------------------
-- Seccion 7: Imagenes / ecografias / ultrasonidos
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS imagenes_ecografias (
  id            BIGSERIAL PRIMARY KEY,
  medico_id     BIGINT      NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  paciente_id   BIGINT      NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  consulta_id   BIGINT      REFERENCES consultas(id) ON DELETE CASCADE,
  archivo       VARCHAR(255),
  mime          VARCHAR(80) DEFAULT 'image/jpeg',
  contenido     BYTEA,                       -- usado cuando UPLOAD_MODE=db
  tipo          VARCHAR(80) DEFAULT 'Ecografia',
  fecha         DATE,
  titulo        VARCHAR(180),
  observaciones TEXT,
  creado_en     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_imagenes_consulta ON imagenes_ecografias(consulta_id);
CREATE INDEX IF NOT EXISTS idx_imagenes_paciente ON imagenes_ecografias(paciente_id);

-- ---------------------------------------------------------------
-- Citas
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citas (
  id           BIGSERIAL PRIMARY KEY,
  medico_id    BIGINT      NOT NULL REFERENCES medicos(id) ON DELETE CASCADE,
  paciente_id  BIGINT      REFERENCES pacientes(id) ON DELETE SET NULL,
  consulta_id  BIGINT      REFERENCES consultas(id) ON DELETE SET NULL,
  fecha        DATE        NOT NULL,
  hora         TIME        NOT NULL,
  motivo       VARCHAR(255),
  paciente_txt VARCHAR(160),      -- para citas de pacientes no registrados
  estado       VARCHAR(20) NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente','atendida','cancelada')),
  notas        TEXT,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_citas_medico_fecha ON citas(medico_id, fecha);
CREATE INDEX IF NOT EXISTS idx_citas_paciente     ON citas(paciente_id);

-- ---------------------------------------------------------------
-- Sesiones (durable en entornos serverless como Vercel)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sesiones (
  id       VARCHAR(128) PRIMARY KEY,
  datos    TEXT        NOT NULL,
  expira   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  creada   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sesiones_expira ON sesiones(expira);

-- ---------------------------------------------------------------
-- Auditoria simple de cambios (opcional, ligera)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS actividad (
  id          BIGSERIAL PRIMARY KEY,
  usuario_id  BIGINT,
  accion      VARCHAR(60) NOT NULL,
  detalle     TEXT,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;
