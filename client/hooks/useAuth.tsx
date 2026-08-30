import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type {
  Session,
  User,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface PatientProfile {
  id: string;
  user_id: string;
  full_name: string;
  date_of_birth: string | null;
  language: "en" | "sw";
  timezone: string;
  weight_kg: number | null;
  patient_reference: string | null;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: PatientProfile | null;
  loading: boolean;

  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{
    error: string | null;
  }>;

  signIn: (
    email: string,
    password: string,
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;

  refreshProfile: () => Promise<void>;
}

const AuthContext =
  createContext<AuthContextValue | undefined>(
    undefined,
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] =
    useState<Session | null>(null);

  const [user, setUser] =
    useState<User | null>(null);

  const [profile, setProfile] =
    useState<PatientProfile | null>(null);

  const [loading, setLoading] =
    useState(true);

  const fetchProfile = async (
    userId: string,
  ) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error(
          "Failed to load patient profile:",
          error,
        );

        setProfile(null);
        return;
      }

      setProfile(
        data as PatientProfile | null,
      );
    } catch (error) {
      console.error(
        "Unexpected profile loading error:",
        error,
      );

      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth =
      async () => {
        try {
          const {
            data: {
              session,
            },
            error,
          } =
            await supabase.auth.getSession();

          if (!mounted) {
            return;
          }

          if (error) {
            console.error(
              "Failed to get Supabase session:",
              error,
            );

            setSession(null);
            setUser(null);
            setProfile(null);
            return;
          }

          setSession(session);
          setUser(
            session?.user ?? null,
          );

          if (session?.user) {
            await fetchProfile(
              session.user.id,
            );
          } else {
            setProfile(null);
          }
        } catch (error) {
          console.error(
            "Authentication initialization error:",
            error,
          );

          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    initializeAuth();

    const {
      data: authListener,
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          nextSession,
        ) => {
          if (!mounted) {
            return;
          }

          setSession(nextSession);
          setUser(
            nextSession?.user ?? null,
          );

          if (nextSession?.user) {
            await fetchProfile(
              nextSession.user.id,
            );
          } else {
            setProfile(null);
          }

          if (mounted) {
            setLoading(false);
          }
        },
      );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
  ) => {
    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name:
                fullName,
            },
          },
        });

      if (error) {
        return {
          error: error.message,
        };
      }

      if (!data.user) {
        return {
          error:
            "Account creation did not return a user.",
        };
      }

      const {
        error: profileError,
      } =
        await supabase
          .from("patient_profiles")
          .insert({
            user_id:
              data.user.id,
            full_name:
              fullName,
            language: "en",
            timezone:
              "Africa/Nairobi",
          });

      if (profileError) {
        console.error(
          "Patient profile creation failed:",
          profileError,
        );

        return {
          error:
            profileError.message,
        };
      }

      /*
       * Demo data seeding is optional.
       *
       * A failure here should not make an otherwise
       * successful account registration fail.
       */
      try {
        const {
          error: demoError,
        } =
          await supabase.rpc(
            "seed_demo_data",
          );

        if (demoError) {
          console.warn(
            "Demo data seeding was not completed:",
            demoError,
          );
        }
      } catch (demoError) {
        console.warn(
          "Demo data seeding failed:",
          demoError,
        );
      }

      await fetchProfile(
        data.user.id,
      );

      return {
        error: null,
      };
    } catch (error) {
      console.error(
        "Sign-up error:",
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create account.",
      };
    }
  };

  const signIn = async (
    email: string,
    password: string,
  ) => {
    try {
      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email,
            password,
          },
        );

      if (error) {
        return {
          error: error.message,
        };
      }

      if (data.user) {
        setSession(data.session);
        setUser(data.user);

        await fetchProfile(
          data.user.id,
        );
      }

      return {
        error: null,
      };
    } catch (error) {
      console.error(
        "Sign-in error:",
        error,
      );

      return {
        error:
          error instanceof Error
            ? error.message
            : "Unable to sign in.",
      };
    }
  };

  const signOut = async () => {
    try {
      const {
        error,
      } =
        await supabase.auth.signOut();

      if (error) {
        console.error(
          "Sign-out error:",
          error,
        );
      }
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const refreshProfile =
    async () => {
      if (!user) {
        setProfile(null);
        return;
      }

      await fetchProfile(
        user.id,
      );
    };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx =
    useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return ctx;
}
