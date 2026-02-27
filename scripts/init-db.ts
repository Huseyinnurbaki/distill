import { exec } from 'child_process';
import { promisify } from 'util';
import { initializeAdmin } from '../lib/init-admin';
import { initializePersonas } from '../lib/init-personas';

const execAsync = promisify(exec);

async function initDatabase() {
  try {
    console.log('Initializing database...');

    console.log('Running Prisma migrations...');
    await execAsync('npx prisma migrate deploy');

    console.log('Generating Prisma client...');
    await execAsync('npx prisma generate');

    console.log('Initializing admin user...');
    await initializeAdmin();

    console.log('Initializing personas...');
    await initializePersonas();

    console.log('Database initialization complete!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
