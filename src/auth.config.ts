import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no db / bcrypt imports) used by middleware.
export const authConfig = {
  // Vercel's proxy sets x-forwarded-host/proto reliably; without this,
  // Auth.js falls back to localhost and issues cookies under the wrong
  // (non-secure) name, which the middleware on HTTPS can't see.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage =
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/signup");

      if (isAuthPage) {
        if (isLoggedIn)
          return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
  providers: [], // added in auth.ts
} satisfies NextAuthConfig;
