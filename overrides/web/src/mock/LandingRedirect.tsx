"use client";

// Thay cho proxy.ts (cần máy chủ): ai đã có phiên đăng nhập mở trang đầu thì đưa thẳng sang /login?done=1 như bản thật.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasSessionCookie } from "../../../server/src/browser/storage";

export function LandingRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (hasSessionCookie()) router.replace("/login?done=1");
  }, [router]);
  return null;
}
