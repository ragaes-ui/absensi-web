const { Client } = require('pg');

exports.handler = async (event, context) => {
  // 1. Hanya izinkan method GET (Ambil data)
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 2. Koneksi ke Database (Neon/PostgreSQL)
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // 3. Cek Mode: Apakah untuk Tampilan Tabel (sedikit) atau Excel (banyak)?
    // Jika ?mode=export, kita ambil 1000 data. Jika tidak, ambil 50 data saja biar cepat.
    const isExport = event.queryStringParameters.mode === 'export';
    const limitQuery = isExport ? "LIMIT 1000" : "LIMIT 50";

    // 4. Query SQL Utama (JOIN TABLE)
    // Mengambil data log absen + mencocokkan ID dengan tabel employees untuk dapat Nama
    const query = `
      SELECT 
        log.finger_id, 
        log.scan_time, 
        log.status, 
        emp.nama,    
        emp.jabatan  
      FROM attendance_logs log
      LEFT JOIN employees emp ON log.finger_id = emp.finger_id
      ORDER BY log.scan_time DESC 
      ${limitQuery}
    `;
    
    // Eksekusi Query
    const res = await client.query(query);
    
    // Tutup koneksi db
    await client.end();

    // 5. Kirim data JSON ke Web
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Mengizinkan akses dari browser
      },
      body: JSON.stringify(res.rows)
    };

  } catch (err) {
    console.error('Database Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gagal mengambil data database." })
    };
  }
};
