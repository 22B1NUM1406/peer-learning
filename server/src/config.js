// Орчны хувьсагчдыг нэг газар уншина. Ингэснээр код бүрт process.env тарахгүй.
const isProd = process.env.NODE_ENV === 'production';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL тохируулаагүй байна (.env файлыг шалгана уу)');
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3000,
  databaseUrl: process.env.DATABASE_URL,
  // Session хэдэн хоног хүчинтэй байх вэ
  sessionDays: Number(process.env.SESSION_DAYS) || 7,
  // Railway volume холбосон зам (FR-23-т ашиглана)
  uploadDir: process.env.UPLOAD_DIR || './uploads',
};
