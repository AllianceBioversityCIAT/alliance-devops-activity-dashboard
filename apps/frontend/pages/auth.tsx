import { useEffect, useRef, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { exchangeAuthCode } from "../src/infrastructure/auth/CognitoClient";

export default function AuthPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const didExchangeRef = useRef(false);

  useEffect(() => {
    if (didExchangeRef.current) return;
    didExchangeRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) {
      setError("Missing authorization code");
      return;
    }
    (async () => {
      try {
        await exchangeAuthCode(code);
        router.replace("/dashboard");
      } catch {
        setError("Token exchange failed");
      }
    })();
  }, [router]);

  return (
    <>
      <Head>
        <title>Authenticating…</title>
      </Head>
      <main style={{ maxWidth: 480, margin: "48px auto", padding: 16, fontFamily: "system-ui" }}>
        <h1>Signing you in…</h1>
        {!error ? <p style={{ color: "#666" }}>Please wait while we complete the sign-in.</p> : null}
        {error ? <div style={{ color: "crimson", marginTop: 12 }}>{error}</div> : null}
      </main>
    </>
  );
}
