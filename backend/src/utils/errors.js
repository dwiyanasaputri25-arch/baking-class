export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function notFound(_req, res) {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
}

export function errorHandler(error, _req, res, _next) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Ukuran bukti pembayaran maksimal 5 MB.' });
  }
  if (error?.name === 'ZodError') {
    return res.status(400).json({ error: 'Data tidak valid.', details: error.issues });
  }
  if (error?.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'Email atau data unik sudah digunakan.' });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  if (error?.name === 'MulterError') {
    return res.status(400).json({ error: 'Bukti pembayaran tidak valid.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
}
