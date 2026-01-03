// ... kode koneksi database sebelumnya ...

    // Cek apakah ada parameter ?mode=export di URL
    const isExport = event.queryStringParameters.mode === 'export';

    // Jika mode export, ambil 1000 data terakhir (atau hapus LIMIT untuk semua)
    // Jika tidak, ambil 50 saja untuk tampilan tabel agar cepat
    const limitQuery = isExport ? "LIMIT 1000" : "LIMIT 50";

    const query = `
      SELECT finger_id, scan_time, status 
      FROM attendance_logs 
      ORDER BY scan_time DESC 
      ${limitQuery}
    `;

// ... sisa kode sama seperti sebelumnya ...

// File: netlify/functions/api.js
const { Client } = require('pg');

exports.handler = async (event, context) => {
  // Hanya izinkan method GET
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Query ambil 50 data terakhir
    const query = `
      SELECT finger_id, scan_time, status 
      FROM attendance_logs 
      ORDER BY scan_time DESC 
      LIMIT 50
    `;
    
    const res = await client.query(query);
    await client.end();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(res.rows)
    };

  } catch (err) {
    console.error('Database Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengambil data" })
    };
  }
};
