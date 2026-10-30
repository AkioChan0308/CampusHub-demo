"use client";

// Phần riêng của bản demo tĩnh: nhãn nhỏ nói rõ dữ liệu chỉ nằm trong trình duyệt này.

export function DemoBadge() {
  return (
    <div
      role="note"
      style={{ position: "fixed", right: 8, bottom: 8, zIndex: 40, maxWidth: "min(92vw, 320px)", padding: "4px 8px", border: "1px solid var(--l-line, #ccc)", background: "var(--l-paper, #fff)", color: "var(--l-ink-2, #555)", fontSize: 12, lineHeight: 1.3, pointerEvents: "none" }}
    >
      Bản demo: dữ liệu chỉ lưu trong trình duyệt của bạn. Muốn xem hai phía bàn giao: mở thêm một tab và đăng nhập vai khác.
    </div>
  );
}

/** Chạy trước mọi mã khác: đồng hồ của trang đi từ 03/10/2026 09:00 (ngày dữ liệu mẫu được viết), nhớ mốc để các lần mở sau đi tiếp. */
export const CLOCK_SCRIPT = `(function(){try{var K="campushub-demo:clock",s=localStorage.getItem(K);var o=s?Number(s):NaN;if(!isFinite(o)){o=Date.parse("2026-10-03T09:00:00+07:00")-Date.now();localStorage.setItem(K,String(o));}var R=Date,N=R.now.bind(R);function D(a,b,c,d,e,f,g){if(!(this instanceof D))return new R(N()+o).toString();var n=arguments.length;return n===0?new R(N()+o):n===1?new R(a):new R(a,b,c||1,d||0,e||0,f||0,g||0);}D.prototype=R.prototype;D.now=function(){return N()+o};D.parse=R.parse;D.UTC=R.UTC;window.Date=D;}catch(e){}})();`;
