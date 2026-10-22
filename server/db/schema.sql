-- =====================================================================
-- Оюутан хоорондын харилцан суралцах систем — өгөгдлийн сангийн схем
-- PostgreSQL 16 (Neon). Тайлангийн 2.2-ын ER загвар (12 entity)-аас гаргав.
-- Ажиллуулах: psql "$DATABASE_URL" -f schema.sql
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;          -- FR-25 ижил асуулт

-- ---------------------------------------------------------------- USERS
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  email          VARCHAR(255)  NOT NULL UNIQUE,
  password_hash  TEXT          NOT NULL,                       -- Argon2id (NFR-01)
  role           VARCHAR(10)   NOT NULL DEFAULT 'student'
                   CHECK (role IN ('student', 'admin')),
  faculty        VARCHAR(150),
  year           SMALLINT      CHECK (year BETWEEN 1 AND 6),
  status         VARCHAR(10)   NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'suspended')),   -- FR-18
  reputation     INTEGER       NOT NULL DEFAULT 0,             -- FR-24
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------- SESSIONS
-- Cookie-д зөвхөн id (санамсаргүй 32 байт) хадгалагдана (NFR-02).
CREATE TABLE sessions (
  id          VARCHAR(64)  PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ  NOT NULL
);
CREATE INDEX sessions_user_idx    ON sessions(user_id);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

-- ------------------------------------------------------------- SUBJECTS
CREATE TABLE subjects (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(150) NOT NULL UNIQUE,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE              -- FR-17
);

-- -------------------------------------------------------- USER_SUBJECTS
CREATE TABLE user_subjects (                                  -- FR-04
  user_id     INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  subject_id  INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, subject_id)
);
CREATE INDEX user_subjects_subject_idx ON user_subjects(subject_id);

-- ------------------------------------------------------------ QUESTIONS
CREATE TABLE questions (
  id                  SERIAL PRIMARY KEY,
  author_id           INTEGER      NOT NULL REFERENCES users(id),
  subject_id          INTEGER      NOT NULL REFERENCES subjects(id),
  title               VARCHAR(200) NOT NULL,
  body                TEXT         NOT NULL,
  is_anonymous        BOOLEAN      NOT NULL DEFAULT FALSE,     -- FR-20
  accepted_answer_id  INTEGER,                                 -- FK доор нэмнэ
  is_hidden           BOOLEAN      NOT NULL DEFAULT FALSE,     -- FR-16
  -- FR-13: Монгол хэлний тусгай тохиргоо байхгүй тул 'simple' ашиглана
  search_vector       TSVECTOR GENERATED ALWAYS AS (
                        setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
                        setweight(to_tsvector('simple', coalesce(body,  '')), 'B')
                      ) STORED,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX questions_search_idx  ON questions USING GIN (search_vector);
CREATE INDEX questions_title_trgm  ON questions USING GIN (title gin_trgm_ops);  -- FR-25
CREATE INDEX questions_subject_idx ON questions(subject_id, created_at DESC);
CREATE INDEX questions_author_idx  ON questions(author_id);

-- -------------------------------------------------------------- ANSWERS
CREATE TABLE answers (
  id           SERIAL PRIMARY KEY,
  question_id  INTEGER     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  author_id    INTEGER     NOT NULL REFERENCES users(id),
  body         TEXT        NOT NULL,
  is_hidden    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX answers_question_idx ON answers(question_id);
CREATE INDEX answers_author_idx   ON answers(author_id);

-- "Тусалсан" хариулт (FR-12). Тухайн асуултын хариулт мөн эсэхийг Service шалгана.
ALTER TABLE questions
  ADD CONSTRAINT questions_accepted_fk
  FOREIGN KEY (accepted_answer_id) REFERENCES answers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------- VOTES
CREATE TABLE votes (                                          -- FR-11, NFR-10
  user_id     INTEGER     NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  answer_id   INTEGER     NOT NULL REFERENCES answers(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, answer_id)
);
CREATE INDEX votes_answer_idx ON votes(answer_id);

-- ------------------------------------------------------------- COMMENTS
CREATE TABLE comments (                                       -- FR-14
  id           SERIAL PRIMARY KEY,
  author_id    INTEGER     NOT NULL REFERENCES users(id),
  question_id  INTEGER     REFERENCES questions(id) ON DELETE CASCADE,
  answer_id    INTEGER     REFERENCES answers(id)   ON DELETE CASCADE,
  body         VARCHAR(500) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(question_id, answer_id) = 1)            -- яг нэг нь
);
CREATE INDEX comments_question_idx ON comments(question_id);
CREATE INDEX comments_answer_idx   ON comments(answer_id);

-- ------------------------------------------------------------ RESOURCES
CREATE TABLE resources (                                      -- FR-21, FR-23
  id           SERIAL PRIMARY KEY,
  author_id    INTEGER      NOT NULL REFERENCES users(id),
  subject_id   INTEGER      NOT NULL REFERENCES subjects(id),
  title        VARCHAR(200) NOT NULL,
  description  TEXT,
  url          TEXT,                                          -- гадаад холбоос
  file_path    TEXT,                                          -- Railway volume дээрх зам
  mime_type    VARCHAR(50),
  file_size    INTEGER,
  is_hidden    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(url, file_path) = 1),
  CHECK (file_path IS NULL OR (
           mime_type IN ('application/pdf', 'image/png', 'image/jpeg')
           AND file_size BETWEEN 1 AND 10485760))             -- 10 MB
);
CREATE INDEX resources_subject_idx ON resources(subject_id, created_at DESC);

-- -------------------------------------------------------------- REPORTS
CREATE TABLE reports (                                        -- FR-15, FR-16
  id           SERIAL PRIMARY KEY,
  reporter_id  INTEGER      NOT NULL REFERENCES users(id),
  target_type  VARCHAR(10)  NOT NULL
                 CHECK (target_type IN ('question', 'answer', 'comment', 'resource', 'message')),
  target_id    INTEGER      NOT NULL,                         -- полиморф: Service шалгана
  reason       VARCHAR(300) NOT NULL,
  status       VARCHAR(10)  NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'resolved', 'dismissed')),
  resolved_by  INTEGER      REFERENCES users(id),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, target_type, target_id)               -- давхар мэдээлэхгүй
);
CREATE INDEX reports_open_idx ON reports(status, created_at);

-- ------------------------------------------------------------- MESSAGES
CREATE TABLE messages (                                       -- FR-22
  id           SERIAL PRIMARY KEY,
  sender_id    INTEGER     NOT NULL REFERENCES users(id),
  receiver_id  INTEGER     NOT NULL REFERENCES users(id),
  body         VARCHAR(2000) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);
-- Хоёр хүний яриаг хурдан унших
CREATE INDEX messages_pair_idx ON messages(
  LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);

-- -------------------------------------------------------- NOTIFICATIONS
CREATE TABLE notifications (                                  -- FR-19
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         VARCHAR(20) NOT NULL CHECK (type IN ('new_answer', 'accepted')),
  question_id  INTEGER     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  is_read      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);
