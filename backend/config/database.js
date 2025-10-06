const { Pool } = require('pg');

// Use DATABASE_URL for Supabase; fall back to discrete params if provided
const connectionString = process.env.DATABASE_URL;
const pgPool = new Pool(
  connectionString
    ? { connectionString, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, max: 20 }
    : {
  host: process.env.DB_HOST || '127.0.0.1',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'postgres',
        port: Number(process.env.DB_PORT || 5432),
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
      }
);

// Minimal adapter to mimic mysql2's pool.query(sql, params) API
function toPgQuery(sql, params = []) {
  // Replace each '?' with $1, $2, ... while avoiding accidental replacements inside strings (simple approach)
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return { text: converted, values: params };
}

const pool = {
  query: async (sql, params = []) => {
    const { text, values } = toPgQuery(sql, params);
    const result = await pgPool.query(text, values);
    // Return [rows] to be compatible with `const [rows] = await pool.query(...)`
    return [result.rows];
  },
  getConnection: async () => pgPool.connect(),
};

// Simple connectivity check in background (non-blocking)
(async () => {
  try {
    const client = await pgPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ PostgreSQL pool ready');
  } catch (e) {
    console.log('⚠️ PostgreSQL connection check failed:', e.message);
  }
})();

module.exports = pool;
