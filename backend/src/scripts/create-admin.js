'use strict';

const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../models');

async function main() {
  if (!['1', 'true'].includes(process.env.ALLOW_SCHEMA_MIGRATION)) throw new Error('Explicit provisioning acknowledgement is required');
  const email = (process.env.PROVISION_ADMIN_EMAIL || process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.PROVISION_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD || '';
  if (!email || password.length < 12) throw new Error('Explicit admin email and 12+ character password are required');
  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await User.findOne({ where: { email } });
  if (existing) await existing.update({ password: passwordHash, name: 'Runtime Administrator', role: 'admin' });
  else await User.create({ email, password: passwordHash, name: 'Runtime Administrator', role: 'admin' });
  console.log('Administrator provisioned.');
}

main()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
