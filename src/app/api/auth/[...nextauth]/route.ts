import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/options";

// NextAuth endpoints: /api/auth/signin, /api/auth/callback/credentials, /api/auth/session, /api/auth/signout, ...
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
