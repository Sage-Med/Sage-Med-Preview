const sectionLinks = Array.from(document.querySelectorAll('.mast-inner nav a[href^="#"]'));
const sections = sectionLinks.map(link => document.querySelector(link.hash));
function markSection() {
  let current = sections[0];
  const threshold = Math.min(window.innerHeight * 0.32, 190);
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= threshold) current = section;
  }
  sectionLinks.forEach(link => {
    if (link.hash === '#' + current.id) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
let scheduled = false;
window.addEventListener('scroll', () => {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => { markSection(); scheduled = false; });
}, {passive: true});
window.addEventListener('pageshow', markSection);
