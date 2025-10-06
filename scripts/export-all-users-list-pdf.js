const mysql = require('mysql2/promise');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

(async () => {
	const pool = mysql.createPool({
		host: '127.0.0.1',
		user: 'root',
		password: 'Caroline',
		database: 'uai',
		connectionLimit: 10
	});

	try {
		console.log('🔍 Fetching users (id, name)...');
		const [rows] = await pool.query(
			`SELECT id, name FROM users ORDER BY id ASC`
		);
		console.log(`👥 Users found: ${rows.length}`);

		const exportsDir = path.join(process.cwd(), 'exports');
		if (!fs.existsSync(exportsDir)) {
			fs.mkdirSync(exportsDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const fileName = `all_users_list_${timestamp}.pdf`;
		const filePath = path.join(exportsDir, fileName);

		const doc = new PDFDocument({ margin: 40, size: 'A4' });
		doc.pipe(fs.createWriteStream(filePath));

		// Header
		doc.fontSize(18).text('UAI AGENCY - All Users List', { align: 'center' });
		doc.moveDown(0.5);
		doc.fontSize(11).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
		doc.moveDown(1);
		doc.fontSize(12).text(`Total users: ${rows.length}`);
		doc.moveDown(0.5);

		// Table header
		doc.fontSize(12).text('ID', 50, doc.y, { continued: true });
		doc.text('Name', 120);
		doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

		// Rows
		doc.moveDown(0.2);
		doc.fontSize(11);
		rows.forEach(user => {
			doc.text(String(user.id), 50, doc.y, { continued: true });
			doc.text(String(user.name || '').trim() || '');
		});

		doc.end();
		console.log(`✅ PDF generated: ${filePath}`);
	} catch (err) {
		console.error('❌ Failed to generate users list PDF:', err.message);
		process.exitCode = 1;
	} finally {
		pool.end();
	}
})();




