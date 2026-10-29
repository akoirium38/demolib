// Lỗi nghiệp vụ có chủ đích → errorHandler trả về { error: { code, message, details } }.
export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Bạn cần đăng nhập') {
    return new AppError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Bạn không có quyền thực hiện thao tác này') {
    return new AppError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Không tìm thấy tài nguyên') {
    return new AppError(404, 'NOT_FOUND', message);
  }

  static conflict(code, message) {
    return new AppError(409, code, message);
  }

  static unprocessable(code, message) {
    return new AppError(422, code, message);
  }
}
