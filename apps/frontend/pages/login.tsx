import Head from "next/head";
import { startHostedLogin } from "../src/infrastructure/auth/CognitoClient";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>Login - DevOps Activity Dashboard</title>
      </Head>
      <main className="login-root">
        <section className="left">
          <div className="content">
            <p className="tag">DevOps Activity Dashboard</p>
            <h1 className="title">Deployment visibility in one place</h1>
            <p className="description">
              Track deployment activity, review outcomes, and navigate pipeline execution history with a secure
              dashboard experience.
            </p>
            <button type="button" onClick={() => startHostedLogin()} className="login-btn">
              Sign in with corporate account
            </button>
          </div>
        </section>
        <section className="right" aria-label="DevOps illustration" />
      </main>
      <style jsx>{`
        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
          background: #f8fafc;
        }
        .left {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px;
          background: #ffffff;
        }
        .content {
          width: min(460px, 100%);
        }
        .tag {
          margin: 0 0 14px;
          color: #475467;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          font-weight: 700;
        }
        .title {
          margin: 0 0 10px;
          font-size: 34px;
          line-height: 1.15;
          color: #101828;
        }
        .description {
          margin: 0 0 24px;
          color: #475467;
          font-size: 15px;
          line-height: 1.5;
        }
        .login-btn {
          border: 0;
          border-radius: 10px;
          padding: 11px 16px;
          font-size: 14px;
          font-weight: 600;
          background: #111827;
          color: #ffffff;
          cursor: pointer;
        }
        .right {
          min-height: 100vh;
          background-image: linear-gradient(rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.55)),
            url("https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=70");
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
        }
        @media (max-width: 900px) {
          .login-root {
            grid-template-columns: 1fr;
          }
          .left {
            min-height: 56vh;
          }
          .right {
            min-height: 44vh;
          }
          .title {
            font-size: 29px;
          }
        }
      `}</style>
    </>
  );
}
