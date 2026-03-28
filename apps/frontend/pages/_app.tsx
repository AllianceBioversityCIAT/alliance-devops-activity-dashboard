import type { AppProps } from "next/app";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[APP] mount", { pathname: router.pathname, asPath: router.asPath });
  }, [router.pathname, router.asPath]);

  return <Component {...pageProps} />;
}

