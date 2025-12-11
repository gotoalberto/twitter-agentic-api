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
      // DEBUG: Log completo de los datos recibidos
      console.log('🔍 === SIGNIN CALLBACK DEBUG ===');
      console.log('📦 Full profile object:', JSON.stringify(profile, null, 2));
      console.log('👤 User object:', JSON.stringify(user, null, 2));
      console.log('🔑 Account object:', JSON.stringify(account, null, 2));

      // Intentar extraer el username de múltiples formas
      const handle1 = (profile as any)?.data?.username;
      const handle2 = (profile as any)?.username;
      const handle3 = user?.name;
      const handle4 = (user as any)?.username;

      console.log('🔍 Extraction attempts:');
      console.log('  handle1 (profile.data.username):', handle1);
      console.log('  handle2 (profile.username):', handle2);
      console.log('  handle3 (user.name):', handle3);
      console.log('  handle4 (user.username):', handle4);

      // Validar que el usuario está en la whitelist
      const twitterHandle = handle1 || handle2 || handle4;

      console.log('📝 Selected twitterHandle:', twitterHandle);
      console.log('📝 ALLOWED_ADMIN_USERS env var:', process.env.ALLOWED_ADMIN_USERS);

      if (!twitterHandle) {
        console.error('❌ No Twitter handle found in profile');
        console.error('❌ Tried all extraction methods, all returned undefined/null');
        return false;
      }

      const isAdminResult = isAdmin(twitterHandle);
      console.log(`🔐 isAdmin("${twitterHandle}") returned:`, isAdminResult);

      if (!isAdminResult) {
        console.error(`❌ User @${twitterHandle} is not an admin`);
        return false;
      }

      console.log(`✅ Admin login successful: @${twitterHandle}`);
      console.log('🔍 === END SIGNIN CALLBACK DEBUG ===');
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
