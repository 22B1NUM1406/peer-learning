-- 007: Хичээлийг оюутнууд өөрсдөө нэмдэг болгов (FR-27). МУИС-ийн хичээлийн жагсаалтыг (каталог)
-- системд хадгалахгүй: зөвшөөрөл, хуучирсан мөр, нэг хичээл сургууль бүрт хуваагдах асуудалтай байв.
-- Каталогоос үүссэн хичээлүүд энгийн хичээл хэвээр үлдэнэ; ижил нэртэйг нь нэгтгэнэ.

-- 1) Ижил нэртэй хичээлийг (том жижиг үсэг ялгахгүй) хамгийн бага id-тайд нэгтгэнэ
CREATE TEMP TABLE subject_merge AS
  SELECT s.id AS old_id, k.keep_id
    FROM subjects s
    JOIN (SELECT lower(name) AS lname, MIN(id) AS keep_id FROM subjects GROUP BY lower(name) HAVING COUNT(*) > 1) k
      ON lower(s.name) = k.lname
   WHERE s.id <> k.keep_id;

UPDATE questions q SET subject_id = m.keep_id FROM subject_merge m WHERE q.subject_id = m.old_id;
UPDATE resources r SET subject_id = m.keep_id FROM subject_merge m WHERE r.subject_id = m.old_id;
INSERT INTO user_subjects (user_id, subject_id)
  SELECT us.user_id, m.keep_id FROM user_subjects us JOIN subject_merge m ON us.subject_id = m.old_id
  ON CONFLICT DO NOTHING;
DELETE FROM subjects s USING subject_merge m WHERE s.id = m.old_id;   -- user_subjects CASCADE-аар устна

-- 2) Ижил кодтой хоёр хичээл байвал хожуу үүссэнийх кодгүй болно
UPDATE subjects s SET code = NULL
 WHERE s.code IS NOT NULL
   AND EXISTS (SELECT 1 FROM subjects x WHERE x.code = s.code AND x.id < s.id);

-- 3) Хичээлийн нэр, код бүх хичээлд давхцахгүй (005, 006-аас өмнөх шиг)
DROP INDEX IF EXISTS subjects_catalog_key;
DROP INDEX IF EXISTS subjects_manual_name_key;
DROP INDEX IF EXISTS subjects_manual_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_key ON subjects (lower(name));
ALTER TABLE subjects ADD CONSTRAINT subjects_code_key UNIQUE (code);

-- 4) Каталогийг устгана
ALTER TABLE subjects DROP COLUMN IF EXISTS catalog_id;
DROP TABLE IF EXISTS catalog_courses;
