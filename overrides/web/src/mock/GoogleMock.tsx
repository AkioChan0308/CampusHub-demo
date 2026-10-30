"use client";

// Đăng nhập Google MÔ PHỎNG của bản demo: bấm nút thì hiện hộp "Chọn tài khoản", chọn một tài khoản mẫu là vào luôn.
// Không kết nối Google thật, không có khóa, không gửi gì ra ngoài.

import { Dialog as D } from "radix-ui";
import { useMemo, useState } from "react";
import { apiPost } from "@/api/client";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { createSeed } from "@/lib/seed";

export function GoogleMockButton({ className, children }: { className: string; children: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const people = useMemo(() => {
    const state = createSeed();
    return DEMO_ACCOUNTS.map((a) => ({ ...a, person: state.persons.find((p) => p.id === a.personId) }));
  }, []);

  async function pick(personId: string) {
    setBusy(personId);
    try {
      await apiPost("/auth/dev-login", { personId });
      window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/login/?done=1`);
    } catch {
      setBusy(null);
    }
  }

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Trigger asChild>
        <button type="button" className={className}>{children}</button>
      </D.Trigger>
      <D.Portal>
        <D.Overlay className="l-dialog-overlay" />
        <D.Content className="l-dialog">
          <div>
            <D.Title asChild><h2>Chọn tài khoản Google</h2></D.Title>
            <D.Description asChild>
              <div className="l-dialog-body"><p>Bản demo: đây chỉ là mô phỏng, không kết nối Google thật. Chọn một tài khoản mẫu để vào.</p></div>
            </D.Description>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {people.map((a) => (
              <li key={a.personId}>
                <button type="button" className="l-btn2" style={{ width: "100%", justifyContent: "flex-start", textAlign: "left", flexDirection: "column", alignItems: "flex-start", gap: 2, height: "auto", padding: "8px 14px" }}
                  aria-busy={busy === a.personId || undefined} onClick={() => void pick(a.personId)}>
                  <strong>{a.person?.name ?? a.username} · {a.role}</strong>
                  <span className="l-note">{a.person?.email ?? ""}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="l-dialog-actions">
            <D.Close className="l-btn2">Hủy</D.Close>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
