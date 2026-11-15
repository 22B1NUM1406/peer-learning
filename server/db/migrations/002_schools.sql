-- 002: МУИС-ийн бүрэлдэхүүн сургууль, тэнхим; хичээлийг тэдгээрт хамааруулах.
-- Дахин ажиллуулахад аюулгүй (IF NOT EXISTS). Хуучин өгөгдөл хэвээр үлдэнэ:
-- шинэ баганууд хоосон (NULL) эхэлж, админ хичээл бүрийг хуваарилна.

CREATE TABLE IF NOT EXISTS schools (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  short_name  VARCHAR(20)  NOT NULL UNIQUE,
  sort_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS departments (
  id         SERIAL PRIMARY KEY,
  school_id  INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name       VARCHAR(150) NOT NULL,
  UNIQUE (school_id, name)
);

-- Хичээлийн код (жишээ нь ICSI405), заадаг сургууль ба тэнхим.
-- Тэнхим нь заавал биш: тэнхимийн жагсаалт оруулаагүй сургуулийн хичээлийг шууд сургуульд хамааруулна.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS code VARCHAR(20) UNIQUE;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS school_id INTEGER REFERENCES schools(id) ON DELETE SET NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS subjects_school_idx ON subjects (school_id);
CREATE INDEX IF NOT EXISTS departments_school_idx ON departments (school_id);
