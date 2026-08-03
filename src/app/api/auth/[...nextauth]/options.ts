import { AuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db } from '@/db/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user, profile }: any) {
      if (!user?.email) return false;
      try {
        const existing = await db.select().from(users).where(eq(users.email, user.email));
        if (existing.length === 0) {
          await db.insert(users).values({
            id: `u-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            email: user.email,
            name: user.name || profile?.name || '',
            image: user.image || profile?.picture || '',
            createdAt: new Date().toISOString(),
          });
        } else {
          // Keep profile updated
          await db.update(users)
            .set({ 
              name: user.name || profile?.name || existing[0].name, 
              image: user.image || profile?.picture || existing[0].image 
            })
            .where(eq(users.email, user.email));
        }
        return true;
      } catch (error) {
        console.error('Error during user auth sign in check:', error);
        return false;
      }
    },
    async session({ session }: any) {
      if (session?.user?.email) {
        try {
          const [dbUser] = await db.select().from(users).where(eq(users.email, session.user.email));
          if (dbUser) {
            session.user.id = dbUser.id;
          }
        } catch (error) {
          console.error('Error attaching user ID to session:', error);
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  secret: process.env.NEXTAUTH_SECRET || 'lockin-super-secret-development-key',
};
