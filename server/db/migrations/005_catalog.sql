-- 005: МУИС-ийн хичээлийн каталог (db/num-courses.tsv).
-- Каталог нь зөвхөн хайлтад зориулсан лавлах: оюутан тэндээс хичээл сонгоход л
-- subjects хүснэгтэд хичээл үүснэ. Ингэснээр мянга гаруй хичээл жагсаалт, шүүлтүүрийг дүүргэхгүй.
CREATE TABLE IF NOT EXISTS catalog_courses (
  id            SERIAL PRIMARY KEY,
  ext_id        INTEGER      NOT NULL UNIQUE,      -- эх жагсаалтын дугаар: дахин импортлоход шинэчлэх түлхүүр
  code          VARCHAR(20),
  name          VARCHAR(200) NOT NULL,
  credit        NUMERIC(4, 1),
  school_id     INTEGER REFERENCES schools(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  imported_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS catalog_courses_code_idx ON catalog_courses (code);
CREATE INDEX IF NOT EXISTS catalog_courses_name_trgm ON catalog_courses USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS subjects_name_trgm ON subjects USING gin (name gin_trgm_ops);
-- Каталогоос сонгож үүссэн хичээл: аль каталогийн мөрөөс үүссэнийг хадгална.
-- Оюутны өдрийн хязгаарт (FR-27) зөвхөн гараар нэмсэн хичээл тооцогдоно.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS catalog_id INTEGER REFERENCES catalog_courses(id) ON DELETE SET NULL;
