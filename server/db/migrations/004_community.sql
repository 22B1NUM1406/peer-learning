-- 004: санал болгосон 7 боломжид шаардлагатай өөрчлөлтүүд. Дахин ажиллуулахад аюулгүй.

-- (4) Оноог хуурахаас хамгаалах: нэг оюутан нэг хүнд 24 цагт өгөх онооны хязгаараас хэтэрсэн
-- үнэлгээ хадгалагдаж, тоонд орох ч оноо өгөхгүй. Үнэлгээг буцаахад зөвхөн өгсөн оноог хасна.
ALTER TABLE votes ADD COLUMN IF NOT EXISTS awarded BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS votes_user_created_idx ON votes (user_id, created_at);

-- (7) Асуултыг дараа унших, шинэ хариултыг дагахаар хадгалах
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id INTEGER     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);
CREATE INDEX IF NOT EXISTS bookmarks_question_idx ON bookmarks (question_id);

-- (8) Мэдэгдлийн шинэ төрлүүд ба оюутны тохиргоо
--   new_question    — туслах хичээлд шинэ асуулт ирэв (туслагчид)
--   vote            — хариултыг "тустай" гэж үнэлэв (хариулагчид)
--   followed_answer — хадгалсан асуултад шинэ хариулт ирэв
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('new_answer', 'accepted', 'new_question', 'vote', 'followed_answer'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_new_questions BOOLEAN NOT NULL DEFAULT TRUE;
