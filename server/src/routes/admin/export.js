import { db, authAdmin } from '../../db.js';
import AppError from '../../utils/AppError.js';

function parseLogDate(docData) {
  if (!docData) return null;
  const raw = docData.actionTime || docData.createdAt;
  if (!raw) return null;
  if (typeof raw.toDate === 'function') return raw.toDate();
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseLogStatus(docData) {
  if (!docData) return 'unknown';
  return docData.action || docData.status || 'unknown';
}

/**
 * GET /api/v1/admin/export/users.csv
 * Streams user list as a CSV download.
 */
export const exportUsersCSV = async (req, res, next) => {
  try {
    const listResult = await authAdmin.listUsers(1000);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dawa-lens-users.csv"');

    // Header row
    res.write('UID,Name,Email,EmailVerified,Status,Created,LastSignIn\r\n');

    for (const user of listResult.users) {
      const row = [
        user.uid,
        `"${(user.displayName || '').replace(/"/g, '""')}"`,
        user.email || '',
        user.emailVerified,
        user.disabled ? 'suspended' : 'active',
        user.metadata.creationTime || '',
        user.metadata.lastSignInTime || '',
      ].join(',');
      res.write(row + '\r\n');
    }

    res.end();
  } catch (error) {
    console.error('[AdminExport] exportUsersCSV error:', error);
    next(new AppError('Failed to export users CSV', 500));
  }
};

/**
 * GET /api/v1/admin/export/adherence.csv
 * Exports aggregate adherence data as CSV.
 */
export const exportAdherenceCSV = async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snap = await db.collection('doseLogs').limit(5000).get().catch(() => ({ docs: [] }));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="dawa-lens-adherence.csv"');

    res.write('Date,Status,UserID,MedicineName\r\n');

    snap.docs.forEach(doc => {
      const d = doc.data();
      const dateObj = parseLogDate(d);
      if (!dateObj || dateObj < since) return;

      const dateStr = dateObj.toISOString().split('T')[0];
      const status = parseLogStatus(d);
      const row = [
        dateStr,
        status,
        d.userId || '',
        `"${(d.medicineName || '').replace(/"/g, '""')}"`,
      ].join(',');
      res.write(row + '\r\n');
    });

    res.end();
  } catch (error) {
    console.error('[AdminExport] exportAdherenceCSV error:', error);
    next(new AppError('Failed to export adherence CSV', 500));
  }
};

/**
 * GET /api/v1/admin/export/report.pdf
 * Generates a summary PDF report using pdfkit.
 */
export const exportReportPDF = async (req, res, next) => {
  try {
    const { default: PDFDocument } = await import('pdfkit');

    const now = new Date();
    const since30 = new Date(now);
    since30.setDate(since30.getDate() - 30);

    const [
      usersResult,
      medCount,
      doseLogsSnap,
    ] = await Promise.all([
      authAdmin.listUsers(1000),
      db.collection('medicines').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      db.collection('doseLogs').limit(5000).get().catch(() => ({ docs: [] })),
    ]);

    const totalUsers = usersResult.users.length;
    const totalMeds = medCount.data().count;

    let taken = 0, missed = 0, skipped = 0;
    doseLogsSnap.docs.forEach(d => {
      const data = d.data();
      const date = parseLogDate(data);
      if (!date || date < since30) return;
      const status = parseLogStatus(data);
      if (status === 'taken') taken++;
      else if (status === 'missed') missed++;
      else if (status === 'skipped') skipped++;
    });

    const totalDoses = taken + missed + skipped;
    const adherence = totalDoses > 0 ? Math.round((taken / totalDoses) * 100) : 0;

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="dawa-lens-report-${now.toISOString().split('T')[0]}.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Dawa Lens Admin Report', { align: 'center' });
    doc.fontSize(11).font('Helvetica').fillColor('#666')
      .text(`Generated: ${now.toDateString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Section: Platform Overview
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Platform Overview');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    const stats = [
      ['Total Registered Users', totalUsers.toString()],
      ['Total Medications Tracked', totalMeds.toString()],
      ['30-Day Adherence Rate', `${adherence}%`],
    ];

    stats.forEach(([label, value]) => {
      doc.fontSize(12).font('Helvetica').fillColor('#333').text(label, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#000').text(value, { align: 'right' });
      doc.moveDown(0.4);
    });

    doc.moveDown(1);

    // Section: Dose Breakdown (Last 30 Days)
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#000').text('Dose Activity (Last 30 Days)');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.5);

    const doseStats = [
      ['Doses Taken', taken.toString()],
      ['Doses Missed', missed.toString()],
      ['Doses Skipped', skipped.toString()],
      ['Total Dose Events', totalDoses.toString()],
    ];

    doseStats.forEach(([label, value]) => {
      doc.fontSize(12).font('Helvetica').fillColor('#333').text(label, 50, doc.y, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#000').text(value, { align: 'right' });
      doc.moveDown(0.4);
    });

    doc.moveDown(2);
    doc.fontSize(9).font('Helvetica').fillColor('#999')
      .text('© Dawa Lens — Confidential Admin Report. Not for distribution.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('[AdminExport] exportReportPDF error:', error);
    if (!res.headersSent) {
      next(new AppError('Failed to generate PDF report', 500));
    }
  }
};
