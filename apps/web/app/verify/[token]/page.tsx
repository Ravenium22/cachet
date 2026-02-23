import { VerifyClient } from "./VerifyClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api-production-d6be.up.railway.app";

interface TokenInfo {
  success: boolean;
  data?: { projectName: string; message: string };
  error?: string;
}

async function getTokenInfo(token: string): Promise<TokenInfo | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/verify/${token}`, {
      cache: "no-store",
    });
    return (await res.json()) as TokenInfo;
  } catch {
    return null;
  }
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const info = await getTokenInfo(token);

  if (!info || !info.success || !info.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 bg-brand-black">
        <div className="w-full max-w-md rounded-[2px] border border-brand-red bg-brand-void p-8 text-center">
          <div className="mb-4 text-5xl text-brand-red">&#x26A0;</div>
          <h1 className="mb-2 text-xl font-semibold text-brand-red">
            LINK_EXPIRED_OR_INVALID
          </h1>
          <p className="font-mono text-sm text-brand-gray mt-4">
            THIS VERIFICATION LINK HAS EXPIRED, ALREADY BEEN USED, OR IS INVALID.
            PLEASE RETURN TO DISCORD AND CLICK THE VERIFY BUTTON AGAIN TO GET A NEW LINK.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <VerifyClient
        token={token}
        projectName={info.data.projectName}
        message={info.data.message}
      />
    </main>
  );
}
