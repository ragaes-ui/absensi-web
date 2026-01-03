// File: netlify/functions/cdata.js
const { Client } = require('pg');

exports.handler = async (event, context) => {
  // ------------------------------------------------------------------
  // BAGIAN 1: HANDSHAKE (SALAM PEMBUKA DARI MESIN)
  // Mesin mengirim GET request dengan parameter options=all
  // Kita wajib membalas dengan konfigurasi agar mesin mau kirim data.
  // ------------------------------------------------------------------
  if (event.queryStringParameters.options === 'all') {
    const sn = event.queryStringParameters.SN || 'Unknown';
    
    // Konfigurasi standar mesin Solution/ZKTeco
    const responseConfig = 
      `GET OPTION FROM: ${sn}\n` +
      `Stamp=9999\n` +
      `OpStamp=9999\n` +
      `ErrorDelay=30\n` +
      `Delay=10\n` +
      `TransTimes=00:00;14:05\n` +
      `TransInterval=1\n` +
      `TransFlag=1111000000\n` +
      `Realtime=1\n` +
      `Encrypt=0\n`;

    return {
      statusCode: 200,
      body: responseConfig
    };
  }

  // ------------------------------------------------------------------
  // BAGIAN 2: MENERIMA DATA ABSEN (POST REQUEST)
  // Mesin mengirim data log absensi via Body Request
  // ------------------------------------------------------------------
  if (event.httpMethod === 'POST') {
    const body = event.body;

    // Jika body kosong, balas OK saja biar mesin senang
    if (!body) return { statusCode: 200, body: "OK" };

    // Koneksi ke Database Neon/PostgreSQL
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      
      // Data dari mesin biasanya terdiri dari banyak baris
      const rows = body.split('\n');
      
      for (let row of rows) {
        row = row.trim();
        if (!row) continue; // Lewati baris kosong

        // LOGIKA PARSING (PEMECAH DATA)
        // Kita pecah berdasarkan Spasi atau Tab
        const cols = row.split(/\s+/);
        
        // Pastikan baris memiliki data minimal (ID dan Waktu)
        if (cols.length >= 2) {
            let fingerId, scanTime, status;

            // Deteksi Format: Apakah Tanggal & Jam dipisah spasi?
            // Format 1 (Umum): ID  Tanggal  Jam  Status ...
            // Format 2 (Jarang): ID  TanggalJam  Status ...
            
            if (cols[1].includes(':')) {
               // Kasus Tanggal & Jam nempel (jarang terjadi di X802)
               fingerId = cols[0];
               scanTime = cols[1]; 
               status   = cols[2] || '0';
            } else {
               // Kasus Standar Solution X802
               fingerId = cols[0];
               scanTime = cols[1] + ' ' + cols[2]; // Gabungkan Tanggal & Jam
               status   = cols[3] || '0'; // Ambil status (0=Masuk, 1=Pulang)
            }

            // Simpan ke Database
            // ON CONFLICT DO NOTHING = Jika data sudah ada, jangan error, abaikan saja
            const query = `
                INSERT INTO attendance_logs (finger_id, scan_time, status)
                VALUES ($1, $2, $3)
                ON CONFLICT (finger_id, scan_time) DO NOTHING
            `;
            
            await client.query(query, [fingerId, scanTime, status]);
        }
      }

      await client.end();
      
      // WAJIB: Balas "OK" agar mesin tahu data sudah diterima
      // Jika tidak dibalas OK, mesin akan mengirim data yang sama terus menerus
      return {
        statusCode: 200,
        body: "OK"
      };

    } catch (err) {
      console.error('Database Error:', err);
      // Tetap balas OK supaya mesin tidak macet/hang, tapi error tercatat di log Netlify
      return {
        statusCode: 200,
        body: "OK"
      };
    }
  }

  // Default Response jika bukan GET handshake atau POST data
  return {
    statusCode: 404,
    body: "Not Found"
  };
};
