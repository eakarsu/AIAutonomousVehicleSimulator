'use strict';

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../models');

async function migrate() {
  if (process.env.MIGRATE_ON_START !== 'true') return;

  await sequelize.sync();
  const directory = path.join(__dirname, '..', '..', 'migrations');
  for (const filename of fs.readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    await sequelize.query(fs.readFileSync(path.join(directory, filename), 'utf8'));
  }
}

migrate()
  .catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
