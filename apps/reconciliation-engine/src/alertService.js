'use strict';

const nodemailer = require('nodemailer');
const { Pool }   = require('pg');
const { v4: uuidv4 } = require('uuid');
const logger = require('./logger');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.mailtrap.io',
  port:   Number(process.env.SMTP_PORT || 587),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Find all unalerted findings and dispatch SMS + email alerts.
 * In a production system, SMS goes through Africa's Talking API.
 */
async function sendAlerts() {
  const client = await pool.connect();
  try {
    const { rows: findings } = await client.query(
      `SELECT f.id, f.tenant_id, f.tx_ref, f.finding, f.detail,
              t.name AS tenant_name
       FROM reconciliation_findings f
       JOIN tenants t ON t.id = f.tenant_id
       WHERE f.alerted = FALSE
       ORDER BY f.created_at ASC
       LIMIT 100`
    );

    for (const f of findings) {
      const message = buildAlertMessage(f);

      // Dashboard alert (always)
      await persistAlert(client, f.tenant_id, f.id, 'dashboard',
        'system', message);

      // Email alert
      if (process.env.SMTP_HOST && process.env.ALERT_EMAIL_FROM) {
        try {
          await transporter.sendMail({
            from:    process.env.ALERT_EMAIL_FROM,
            to:      process.env.ALERT_EMAIL_TO || process.env.ALERT_EMAIL_FROM,
            subject: `[SACCO Alert] ${f.finding} detected — ${f.tenant_name}`,
            text:    message,
          });
          await persistAlert(client, f.tenant_id, f.id, 'email',
            process.env.ALERT_EMAIL_TO || '', message, 'SENT');
          logger.info('Email alert sent', { finding: f.id, tenantId: f.tenant_id });
        } catch (err) {
          logger.error('Email alert failed', { err: err.message });
          await persistAlert(client, f.tenant_id, f.id, 'email',
            '', message, 'FAILED');
        }
      }

      // Mark as alerted
      await client.query(
        'UPDATE reconciliation_findings SET alerted = TRUE WHERE id = $1',
        [f.id]
      );
    }

    if (findings.length > 0) {
      logger.info(`Alerts dispatched for ${findings.length} findings`);
    }
  } finally {
    client.release();
  }
}

function buildAlertMessage(finding) {
  const detail = typeof finding.detail === 'string'
    ? JSON.parse(finding.detail)
    : finding.detail || {};

  return [
    `SACCO Middleware Alert`,
    `Tenant  : ${finding.tenant_name} (${finding.tenant_id})`,
    `Finding : ${finding.finding}`,
    `Tx Ref  : ${finding.tx_ref}`,
    `Detail  : ${JSON.stringify(detail)}`,
    `Time    : ${new Date().toISOString()}`,
    ``,
    `Login to the auditor dashboard to review and investigate.`,
  ].join('\n');
}

async function persistAlert(client, tenantId, findingId, channel, recipient, message, status = 'SENT') {
  await client.query(
    `INSERT INTO alerts (id, tenant_id, finding_id, channel, recipient, message, sent_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
    [uuidv4(), tenantId, findingId, channel, recipient, message, status]
  );
}

module.exports = { sendAlerts };
