import { prisma } from './prisma';
import { hashPassword } from './bcrypt';

export async function initializeAdmin() {
  const rootUsername = process.env.DISTILL_ROOT_USERNAME;
  const rootPassword = process.env.DISTILL_ROOT_PASSWORD;
  const rootEmail = process.env.DISTILL_ROOT_EMAIL;

  if (!rootUsername || !rootPassword || !rootEmail) {
    console.warn('Root admin credentials not provided in environment variables');
    return;
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { username: rootUsername },
  });

  if (existingAdmin) {
    console.log('Root admin user already exists');
    return;
  }

  const passwordHash = await hashPassword(rootPassword);

  await prisma.user.create({
    data: {
      username: rootUsername,
      email: rootEmail,
      passwordHash,
      authProvider: 'local',
      isAdmin: true,
      isActive: true,
    },
  });

  console.log(`Root admin user "${rootUsername}" created successfully`);
}
