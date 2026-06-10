import "server-only";
import https from "node:https";

/**
 * Minimal Teller API client (https://teller.io/docs/api).
 *
 * Auth: HTTP Basic with the enrollment access token as username, blank password.
 * TLS: development & production environments require mutual TLS with the
 * client certificate from your Teller dashboard. Provide it base64-encoded in
 * TELLER_CERTIFICATE / TELLER_PRIVATE_KEY. Sandbox needs no certificate.
 */

const TELLER_API = "api.teller.io";

export type TellerAccount = {
  id: string;
  name: string;
  type: "depository" | "credit";
  subtype: string; // checking | savings | money_market | cd | credit_card | ...
  institution: { id: string; name: string };
  last_four: string;
  status: "open" | "closed";
};

export type TellerBalance = {
  account_id: string;
  ledger: string; // signed decimal string
  available: string | null;
};

export type TellerTransaction = {
  id: string;
  account_id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: string; // signed decimal string; negative = money out
  status: "posted" | "pending";
  type: string;
  details: {
    category: string | null;
    counterparty: { name: string | null } | null;
  };
};

function decodePem(envValue: string | undefined): Buffer | undefined {
  if (!envValue) return undefined;
  const raw = envValue.includes("-----BEGIN")
    ? envValue
    : Buffer.from(envValue, "base64").toString("utf8");
  return Buffer.from(raw);
}

export function tellerEnvironment() {
  return process.env.TELLER_ENVIRONMENT ?? "sandbox";
}

function tellerRequest<T>(accessToken: string, path: string): Promise<T> {
  const cert = decodePem(process.env.TELLER_CERTIFICATE);
  const key = decodePem(process.env.TELLER_PRIVATE_KEY);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: TELLER_API,
        path,
        method: "GET",
        auth: `${accessToken}:`,
        headers: { Accept: "application/json" },
        // mTLS for development/production; harmless undefined in sandbox
        cert,
        key,
        timeout: 30_000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body) as T);
            } catch {
              reject(new Error("Teller returned invalid JSON"));
            }
          } else {
            reject(
              new Error(
                `Teller API ${path} failed (${res.statusCode}): ${body.slice(0, 200)}`
              )
            );
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("Teller API timeout")));
    req.on("error", reject);
    req.end();
  });
}

export const teller = {
  accounts: (token: string) => tellerRequest<TellerAccount[]>(token, "/accounts"),
  balance: (token: string, accountId: string) =>
    tellerRequest<TellerBalance>(token, `/accounts/${accountId}/balances`),
  transactions: (token: string, accountId: string, count = 300) =>
    tellerRequest<TellerTransaction[]>(
      token,
      `/accounts/${accountId}/transactions?count=${count}`
    ),
};

/** Maps a Teller account to Hearth's account type. */
export function mapTellerAccountType(account: TellerAccount): {
  type: "checking" | "savings" | "credit_card" | "other";
  isLiability: boolean;
} {
  if (account.type === "credit") return { type: "credit_card", isLiability: true };
  switch (account.subtype) {
    case "checking":
      return { type: "checking", isLiability: false };
    case "savings":
    case "money_market":
    case "cd":
      return { type: "savings", isLiability: false };
    default:
      return { type: "other", isLiability: false };
  }
}

/** Maps Teller's transaction categories onto Hearth's default categories. */
export const TELLER_CATEGORY_MAP: Record<string, string> = {
  dining: "Dining Out",
  bar: "Dining Out",
  groceries: "Groceries",
  transport: "Transportation",
  transportation: "Transportation",
  fuel: "Transportation",
  utilities: "Utilities",
  phone: "Utilities",
  software: "Subscriptions",
  entertainment: "Subscriptions",
  health: "Health",
  shopping: "Shopping",
  clothing: "Shopping",
  general: "Shopping",
  home: "Housing",
  income: "Salary",
  travel: "Travel",
};

export function parseTellerAmountCents(amount: string): number {
  return Math.round(parseFloat(amount) * 100);
}
