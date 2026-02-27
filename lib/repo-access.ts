// Helper to build Prisma where clause for repo access
// Users can access repos they own OR global repos
export function getRepoAccessWhere(userId: string, repoId: string) {
  return {
    id: repoId,
    OR: [
      { userId },           // User's own repo
      { isGlobal: true },  // Global repo
    ],
  };
}

export function getReposListWhere(userId: string) {
  return {
    OR: [
      { userId },           // User's own repos
      { isGlobal: true },  // Global repos
    ],
  };
}
