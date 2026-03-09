import { NextAuthOptions } from 'next-auth';
import TwitterProvider from 'next-auth/providers/twitter';
import { isAdmin } from '@/lib/utils/admin';
import { cleanEnvVar } from '@/lib/utils/env';

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: cleanEnvVar(process.env.X_API_CLIENT_ID),
      clientSecret: cleanEnvVar(process.env.X_API_CLIENT_SECRET),
      version: '2.0',
      authorization: {
        params: {
          scope: 'users.read tweet.read',
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.userId = account.providerAccountId;
      }

      if (profile) {
        token.twitterHandle = (profile as any).data?.username || (profile as any).username;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        (session.user as any).twitterHandle = token.twitterHandle as string;
        (session.user as any).username = token.twitterHandle as string;
        (session as any).accessToken = token.accessToken;
      }

      return session;
    },

    async signIn({ user, account, profile }) {
      // Allow ALL users to sign in
      // Admin restrictions are enforced at the page level, not at login
      console.log('🔍 === SIGNIN CALLBACK ===');

      // Extract the username for logging purposes
      const handle1 = (profile as any)?.data?.username;
      const handle2 = (profile as any)?.username;
      const handle4 = (user as any)?.username;
      const twitterHandle = handle1 || handle2 || handle4;

      console.log(`✅ User login: @${twitterHandle || 'unknown'} (ID: ${account?.providerAccountId})`);

      // Check if user is admin (for logging only, not for blocking)
      if (twitterHandle) {
        const isAdminUser = isAdmin(twitterHandle);
        console.log(`👤 User type: ${isAdminUser ? 'Admin' : 'Regular User'}`);
      }

      // Allow ALL users to sign in
      // Admin checks should be done at the page/API level
      return true;
    },
  },

  pages: {
    signIn: '/',
    error: '/',
  },

  session: {
    strategy: 'jwt',
  },

  secret: cleanEnvVar(process.env.NEXTAUTH_SECRET) || undefined,
};
