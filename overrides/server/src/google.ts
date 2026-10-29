// Bản demo trong trình duyệt: không có đăng nhập Google. Giữ lại kiểu và hàm để handler đăng nhập vẫn biên dịch được.

import type { Config } from "./config.ts";

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  name: string;
}

export type ExchangeGoogleCode = (code: string, verifier: string, redirectUri: string) => Promise<GoogleProfile>;

export const pkceChallenge = (verifier: string) => verifier;

export function googleAuthUrl(_config: Config, _redirectUri: string, _state: string, _verifier: string): string {
  return "";
}

export function googleExchange(_config: Config, _now: () => number = Date.now): ExchangeGoogleCode {
  return async () => {
    throw new Error("Bản demo không có đăng nhập Google.");
  };
}
