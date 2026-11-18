-- 006: МУИС-ийн сургууль, салбар, тэнхим, хичээлийг db/num-courses.csv (МУИС-ийн хичээлийн жагсаалт)
-- -ээр бүхэлд нь солино. Өмнөх бүтэц (ШУС-ийг БУС/НУС/ХУС гэж салгасан гэх мэт) ба хичээлүүд алдаатай
-- байсан тул хэрэглэгчийн шийдвэрээр хуучин хичээл ба тэдгээрт холбогдсон асуулт, хариулт, материалыг
-- устгав (TRUNCATE ... CASCADE). Нэг удаа ажиллана (schema_migrations); шинэ бүтцийг seed.js оруулна.

TRUNCATE subjects, catalog_courses, departments, schools RESTART IDENTITY CASCADE;
-- Устсан хариулт, үнэлгээнээс авсан оноо үлдэхгүй
UPDATE users SET reputation = 0;
-- Оюутны сургууль: БУС, НУС, ХУС нь Шинжлэх ухааны сургуулийн салбарууд
UPDATE users SET faculty = 'ШУС' WHERE faculty IN ('БУС', 'НУС', 'ХУС');

-- Сургуулийн ангилал (Бүрэлдэхүүн сургууль / Салбар сургууль), тэнхимийн харьяалах салбар
ALTER TABLE schools ADD COLUMN IF NOT EXISTS kind VARCHAR(40);
ALTER TABLE departments ADD COLUMN IF NOT EXISTS branch VARCHAR(120);

-- Каталог: мөр бүр нэг сургууль, нэгжийн нэг түвшний хичээл. Ижил код өөр сургуульд өөр хичээл
-- байж болох тул түлхүүр нь бүх талбарын хослол (source_key).
ALTER TABLE catalog_courses DROP COLUMN IF EXISTS sisi_id;
ALTER TABLE catalog_courses ADD COLUMN IF NOT EXISTS level VARCHAR(30);
ALTER TABLE catalog_courses ADD COLUMN IF NOT EXISTS branch VARCHAR(120);
ALTER TABLE catalog_courses ADD COLUMN IF NOT EXISTS source_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_courses_source_key ON catalog_courses (source_key);
CREATE INDEX IF NOT EXISTS catalog_courses_school_idx ON catalog_courses (school_id, department_id);

-- Хичээл: каталогийн мөр бүрээс нэг л хичээл үүснэ. Нэр, код нь зөвхөн гараар нэмсэн (каталоггүй)
-- хичээлд давхцахгүй байх ёстой: каталогт ижил нэр, кодтой хичээл өөр сургуульд байдаг.
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_code_key;
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS subjects_name_key;
DROP INDEX IF EXISTS subjects_name_lower_key;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_catalog_key ON subjects (catalog_id) WHERE catalog_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_manual_name_key ON subjects (lower(name)) WHERE catalog_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_manual_code_key ON subjects (code) WHERE catalog_id IS NULL AND code IS NOT NULL;
