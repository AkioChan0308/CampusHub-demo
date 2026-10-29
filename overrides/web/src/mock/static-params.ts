// Bản demo xuất file tĩnh nên mọi đường dẫn có id phải dựng sẵn lúc build: id trong dữ liệu mẫu, cộng một "bể" id cho thứ người xem
// tạo mới (server/src/browser/server.ts lấy id mới từ bể này). Hết bể thì thứ mới tạo vẫn nằm trong dữ liệu, chỉ trang riêng của nó không mở được.
// Đường dẫn lồng nhau (CLB → đợt thu, buổi) chỉ dựng id có sẵn của đúng CLB đó, để số trang không nhân lên.

import { createSeed } from "@/lib/seed";

export const POOL_SIZE = { clb: 6, tin: 24, buoi: 8, "dot-thu": 8, moi: 40 } as const;

const pool = (prefix: keyof typeof POOL_SIZE) => Array.from({ length: POOL_SIZE[prefix] }, (_, i) => `${prefix}-n${i + 1}`);

type Parent = { params?: { clubId?: string } };
const ofClub = <T extends { id: string; clubId: string }>(rows: T[], parent?: Parent) =>
  rows.filter((r) => !parent?.params?.clubId || r.clubId === parent.params.clubId).map((r) => r.id);

export const clubIds = () => [...createSeed().clubs.map((c) => c.id), ...pool("clb")].map((clubId) => ({ clubId }));
export const collectionIds = (parent?: Parent) => [...ofClub(createSeed().collections, parent), ...pool("dot-thu")].map((collectionId) => ({ collectionId }));
export const eventIds = (parent?: Parent) => [...ofClub(createSeed().events, parent), ...pool("buoi")].map((eventId) => ({ eventId }));
export const postIds = () => [...createSeed().posts.map((p) => p.id), ...pool("tin")].map((postId) => ({ postId }));
export const inviteCodes = () => {
  const seed = createSeed();
  const codes = new Set<string>(pool("moi"));
  for (const m of seed.memberships) if (m.inviteCode) codes.add(m.inviteCode);
  for (const p of seed.persons) codes.add(`moi-${p.id}`);
  return [...codes].map((code) => ({ code }));
};
