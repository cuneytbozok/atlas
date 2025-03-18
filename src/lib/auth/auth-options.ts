import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import { comparePassword } from './password';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await comparePassword(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Get the user's roles
        const roles = user.userRoles.map((ur: { role: { name: string } }) => ur.role.name);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          roles,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.roles = user.roles;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.roles = token.roles as string[];
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
}; 