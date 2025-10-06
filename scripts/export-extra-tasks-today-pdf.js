const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const mysql = require('mysql2/promise');

function renderTable(doc, rows, title) {
  doc.addPage();
  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown();

  const header = ['ID', 'Name', 'Phone', 'Level', 'Daily Limit', 'Completed Today'];
  const colWidths = [50, 180, 140, 60, 90, 120];

  const startX = 50;
  let y = doc.y;

  doc.fontSize(11).fillColor('#000');
  header.forEach((h, i) => {
    const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, x, y, { width: colWidths[i], continued: false });
  });
  y += 18;
  doc.moveTo(startX, y).lineTo(startX + colWidths.reduce((a, b) => a + b, 0), y).stroke();
  y += 8;

  rows.forEach(r => {
    const values = [r.id, r.name, r.phone, r.level, r.daily_limit, r.completed_today];
    values.forEach((v, i) => {
      const x = startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0);
      doc.text(String(v), x, y, { width: colWidths[i], continued: false });
    });
    y += 16;
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }
  });
}

(async () => {
  const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'Caroline',
    database: 'uai',
    connectionLimit: 10
  });

  try {
    const baseSql = `
      SELECT 
        u.id,
        u.name,
        u.phone,
        u.level,
        COALESCE(l.daily_tasks, 5) AS daily_limit,
        COUNT(ut.id) AS completed_today
      FROM users u
      LEFT JOIN levels l ON l.level = u.level
      LEFT JOIN user_tasks ut 
        ON ut.user_id = u.id 
       AND ut.is_complete = 1 
       AND DATE(ut.completed_at) = CURDATE()
      GROUP BY u.id, u.name, u.phone, u.level, l.daily_tasks
    `;

    const [allRows] = await pool.query(baseSql + ` ORDER BY completed_today DESC, u.id ASC`);
    const [exceededRows] = await pool.query(baseSql + ` HAVING completed_today > COALESCE(l.daily_tasks, 5) ORDER BY completed_today DESC, u.id ASC`);

    const outDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

    const dateStr = new Date().toISOString().slice(0,10);

    // Extra tasks PDF
    const extraPath = path.join(outDir, `extra_tasks_today_${dateStr}.pdf`);
    const doc1 = new PDFDocument({ margin: 40, size: 'A4' });
    doc1.pipe(fs.createWriteStream(extraPath));
    doc1.fontSize(22).text('Users Exceeding Today\'s Task Limit', { align: 'center' });
    doc1.moveDown();
    doc1.fontSize(12).text(`Date: ${dateStr}`);
    doc1.moveDown(0.5);
    renderTable(doc1, exceededRows, '');
    doc1.end();

    // All users PDF
    const allPath = path.join(outDir, `all_users_tasks_today_${dateStr}.pdf`);
    const doc2 = new PDFDocument({ margin: 40, size: 'A4' });
    doc2.pipe(fs.createWriteStream(allPath));
    doc2.fontSize(22).text('All Users - Today\'s Task Counts vs Limits', { align: 'center' });
    doc2.moveDown();
    doc2.fontSize(12).text(`Date: ${dateStr}`);
    doc2.moveDown(0.5);
    renderTable(doc2, allRows, '');
    doc2.end();

    console.log('Exported PDFs:');
    console.log(' -', extraPath);
    console.log(' -', allPath);
  } catch (e) {
    console.error('PDF export error:', e);
    process.exit(1);
  } finally {
    pool.end();
  }
})();





