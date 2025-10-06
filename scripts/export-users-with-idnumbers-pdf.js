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
		console.log('🔍 Fetching users with ID numbers...');
		const [rows] = await pool.query(
			`SELECT id, name, id_number FROM users WHERE id_number IS NOT NULL AND id_number <> '' ORDER BY id ASC`
		);
		console.log(`👥 Users with ID numbers: ${rows.length}`);

		const exportsDir = path.join(process.cwd(), 'exports');
		if (!fs.existsSync(exportsDir)) {
			fs.mkdirSync(exportsDir, { recursive: true });
		}

		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const fileName = `users_with_id_numbers_${timestamp}.pdf`;
		const filePath = path.join(exportsDir, fileName);

		const doc = new PDFDocument({ margin: 40, size: 'A4' });
		doc.pipe(fs.createWriteStream(filePath));

		// Header
		doc.fontSize(18).text('UAI AGENCY - Users With ID Numbers', { align: 'center' });
		doc.moveDown(0.5);
		doc.fontSize(11).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
		doc.moveDown(1);
		doc.fontSize(12).text(`Total users (with ID numbers): ${rows.length}`);
		doc.moveDown(0.5);

		// Table header
		doc.fontSize(12).text('User ID', 50, doc.y, { continued: true });
		doc.text('Name', 120, doc.y, { continued: true });
		doc.text('ID Number', 340);
		doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

		// Rows
		doc.moveDown(0.2);
		doc.fontSize(11);
		rows.forEach(user => {
			doc.text(String(user.id), 50, doc.y, { continued: true });
			doc.text(String(user.name || '').trim(), 120, doc.y, { continued: true });
			doc.text(String(user.id_number || ''), 340);
		});

		doc.end();
		console.log(`✅ PDF generated: ${filePath}`);
	} catch (err) {
		console.error('❌ Failed to generate ID numbers PDF:', err.message);
		process.exitCode = 1;
	} finally {
		pool.end();
	}
})();




