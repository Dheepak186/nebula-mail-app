"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Once NextAuth confirms the user is signed in, send them
  // straight to the Inbox automatically - no manual URL change
  // needed.
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/mail");
    }
  }, [status, router]);

  // While we're checking, or once we know the user is signed in
  // and about to be redirected, show a simple neutral screen
  // instead of flashing the sign-in button.
  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500 text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4">
      <h1 className="text-2xl font-bold">Nebula Mail App</h1>
      <button
        onClick={() => signIn("google", { callbackUrl: "/mail" })}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg"
      >
        Sign in with Google
      </button>
    </div>
  );
}
