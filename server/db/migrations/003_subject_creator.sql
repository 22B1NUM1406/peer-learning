-- 003: оюутан асуух хичээлээ өөрөө нэмдэг болсон тул хэн, хэзээ нэмснийг хадгална (FR-27).
-- Анхны (seed) болон админы нэмсэн хичээлд created_by хоосон байна.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
-- Нэрийн том, жижиг үсгийн ялгаагүй давхардлыг өгөгдлийн сангийн түвшинд хориглоно
CREATE UNIQUE INDEX IF NOT EXISTS subjects_name_lower_key ON subjects (lower(name));
CREATE INDEX IF NOT EXISTS subjects_created_by_idx ON subjects (created_by, created_at);
