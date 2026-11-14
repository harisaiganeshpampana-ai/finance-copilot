import "next-auth";

// Add the CalmOwe (MongoDB) user id to the session so server code can load the user's own data.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
