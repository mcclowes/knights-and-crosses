export const SOCKET_PATH = process.env.SOCKET_PATH || '/api/socket';

export const isKvConfigured = () =>
  Boolean(
    process.env.KV_REST_API_URL &&
      process.env.KV_REST_API_TOKEN &&
      process.env.KV_URL
  );
