/* BRIDGE subpage shared JS — v1.0 */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); io.unobserve(e.target); } });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));

const nav = document.getElementById('nav');
const prog = document.getElementById('prog');
window.addEventListener('scroll', () => {
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
  if (prog) {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (window.scrollY / h * 100) + '%';
  }
});

/* ===== v2.0 — パララックスと磁力ボタン(控えめ・reduced-motion 尊重) ===== */
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const plxEls = document.querySelectorAll('[data-plx]');
if (plxEls.length && !REDUCED) {
  const upd = () => {
    plxEls.forEach(el => {
      const box = (el.closest('section') || el.parentElement).getBoundingClientRect();
      el.style.transform = `translateY(${(box.top * (+el.dataset.plx || 0.1)).toFixed(1)}px)`;
    });
  };
  addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
  upd();
}

if (matchMedia('(pointer:fine)').matches && !REDUCED) {
  document.querySelectorAll('.notes-cta,.toolbox-btn,.buy-btn,.showcase-cta,.jump-chip').forEach(b => {
    b.addEventListener('mousemove', e => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * 0.12).toFixed(1)}px,${((e.clientY - r.top - r.height / 2) * 0.3).toFixed(1)}px)`;
    });
    b.addEventListener('mouseleave', () => { b.style.transform = ''; });
  });
}
