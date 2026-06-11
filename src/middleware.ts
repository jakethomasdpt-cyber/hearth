import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // /api routes handle their own auth (NextAuth handlers, cron Bearer token)
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
