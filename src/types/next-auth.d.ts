import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      twitterHandle?: string;
      username?: string;
    };
    accessToken?: string;
  }

  interface User {
    id?: string;
    twitterHandle?: string;
    username?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    twitterHandle?: string;
    accessToken?: string;
  }
}
