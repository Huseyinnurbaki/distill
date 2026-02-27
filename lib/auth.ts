import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/bcrypt';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.passwordHash) {
          throw new Error('Invalid credentials');
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error('Invalid credentials');
        }

        if (!user.isActive) {
          throw new Error('Account pending approval');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          username: user.username,
          isAdmin: user.isAdmin,
          isActive: user.isActive,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        const autoApprove = process.env.GOOGLE_AUTO_APPROVE === 'true';

        if (!existingUser) {
          const baseUsername = user.email!.split('@')[0];
          let username = baseUsername;
          let counter = 2;

          while (await prisma.user.findUnique({ where: { username } })) {
            username = `${baseUsername}${counter}`;
            counter++;
          }

          await prisma.user.create({
            data: {
              email: user.email!,
              username,
              authProvider: 'google',
              isActive: autoApprove,
              isAdmin: false,
            },
          });

          if (!autoApprove) return '/pending-approval';
          return true;
        }

        if (!existingUser.isActive) {
          if (autoApprove) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { isActive: true },
            });
            return true;
          }
          return '/pending-approval';
        }

        return true;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.isAdmin = dbUser.isAdmin;
          token.isActive = dbUser.isActive;
          token.username = dbUser.username;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.isActive = token.isActive as boolean;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
});
