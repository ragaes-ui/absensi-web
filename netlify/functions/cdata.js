const { Client } = require('pg');

exports.handler = async (event, context) => {
  // ---------------------------------------------------
  // 1. HANDSHAKE (Saat mesin pertama kali konek)
  // ---------------------------------------------------
  if (event.queryStringParameters.options === 'all') {
    const sn = event.queryStringParameters.SN || 'Unknown';
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

  // ---------------------------------------------------
  // 2. TERIMA DATA (Saat mesin kirim log absen)
  // ---------------------------------------------------
  if (event.httpMethod === 'POST') {
    const body = event.body;
    
    // Cek apakah ada data
    if (!body) {
      return { statusCode: 200, body: "No Data" };
    }

    // Koneksi ke Database (Mengambil dari Environment Variable Netlify)
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false } // Wajib untuk Neon/Supabase/Cloud DB
    });

    try {
      await client.connect();
      
      const rows = body.split('\n');
      
      for (let row of rows) {
        row = row.trim();
        if (!row) continue;

        // Format data Mesin Solution: ID <tab> Waktu <tab> Status <tab> ...
        const cols = row.split('\t');
        
        if (cols.length >= 2) {
          const fingerId = cols[0];
          const scanTime = cols[1];
          const status = cols[2] || '0';
          
          // Query Insert PostgreSQL (Syntax beda dikit dgn MySQL)
          // ON CONFLICT DO NOTHING = IGNORE (Mencegah duplikat)
          const query = `
            INSERT INTO attendance_logs (finger_id, scan_time, status)
            VALUES ($1, $2, $3)
            ON CONFLICT (finger_id, scan_time) DO NOTHING
          `;
          
          await client.query(query, [fingerId, scanTime, status]);
        }
      }

      await client.end();
      
      // Respon WAJIB "OK"
      return {
        statusCode: 200,
        body: "OK"
      };

    } catch (err) {
      console.error('Database Error:', err);
      return {
        statusCode: 500,
        body: "Error DB"
      };
    }
  }

  // Default response
  return {
    statusCode: 404,
    body: "Not Found"
  };
};
