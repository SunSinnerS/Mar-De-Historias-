const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'LMH',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  timezone: 'Z',
  charset: 'utf8mb4',
});

async function testConnection() {
  const [rows] = await pool.execute('SELECT 1 AS ok');
  return rows?.[0]?.ok === 1;
}

module.exports = {
  pool,
  testConnection,
};
