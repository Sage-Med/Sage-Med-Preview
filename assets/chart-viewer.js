const viewer = document.getElementById('chart-viewer');
const viewport = viewer.querySelector('.chart-viewport');
const closeButton = document.getElementById('chart-close');
const zoomButton = document.getElementById('chart-zoom');
let opener;
let background = [];
let entering = false;

function setZoom(zoomed) {
  viewport.classList.toggle('is-zoomed', zoomed);
  zoomButton.textContent = zoomed ? 'Fit to screen' : 'Zoom in';
  if (!zoomed) viewport.scrollTo(0, 0);
}

function dismiss() {
  if (viewer.hidden) return;
  viewer.hidden = true;
  document.documentElement.classList.remove('chart-open');
  background.forEach(element => { element.inert = false; });
  background = [];
  setZoom(false);
  opener.focus({preventScroll: true});
}

async function closeViewer() {
  if (document.fullscreenElement === viewer) {
    try { await document.exitFullscreen(); } catch { /* The browser may already be exiting. */ }
  }
  dismiss();
}

async function showViewer(event) {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (!viewer.hidden || entering) return;
  opener = event.currentTarget;
  viewer.hidden = false;
  document.documentElement.classList.add('chart-open');
  background = Array.from(document.querySelectorAll('body > .skip, body > header, body > main, body > footer'))
    .filter(element => !element.inert);
  background.forEach(element => { element.inert = true; });
  closeButton.focus({preventScroll: true});
  if (viewer.requestFullscreen && document.fullscreenEnabled) {
    entering = true;
    try {
      await viewer.requestFullscreen();
      if (viewer.hidden && document.fullscreenElement === viewer) await document.exitFullscreen();
    } catch {
      // The fixed viewer fills the window in embedded browsers without native fullscreen.
    } finally { entering = false; }
  }
}

document.querySelectorAll('[data-open-chart]').forEach(link => link.addEventListener('click', showViewer));
zoomButton.addEventListener('click', () => setZoom(!viewport.classList.contains('is-zoomed')));
closeButton.addEventListener('click', closeViewer);
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) dismiss();
});
viewer.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeViewer();
  }
});
