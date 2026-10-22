// Хүлээгдэж буй алдааг (буруу оролт, эрхгүй гэх мэт) энэ класаар шиддэг.
// errorHandler нь status, code-ийг нь уншаад клиентэд ойлгомжтой хариу буцаана.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message) => new AppError(400, 'VALIDATION', message);
export const unauthorized = (message = 'Нэвтэрнэ үү') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Энэ үйлдлийг хийх эрхгүй') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Олдсонгүй') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (message) => new AppError(409, 'CONFLICT', message);
