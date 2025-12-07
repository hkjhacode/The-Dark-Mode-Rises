const cssInvert = `
html {
  background-color: white !important;
  filter: invert(1) hue-rotate(180deg) !important;
  min-height: 100vh !important;
}
img, video, iframe, canvas, svg, :not(object):not(body) > embed {
  filter: invert(1) hue-rotate(180deg) !important;
}
`;

const cssSimple = `
*, *::before, *::after {
  background-color: #121212 !important;
  color: #e0e0e0 !important;
  border-color: #333 !important;
  box-shadow: none !important;
  text-shadow: none !important;
}
a, a * {
  color: #8ab4f8 !important;
}
input, textarea, select, button {
  background-color: #333 !important;
  color: white !important;
  border: 1px solid #555 !important;
}
img, video, iframe, canvas, svg {
  background-color: transparent !important;
  opacity: 0.8;
  transition: opacity 0.3s;
}
img:hover, video:hover {
  opacity: 1;
}
`;

const styleId = 'universal-dark-mode-style';
const blueLightId = 'universal-blue-light-filter';

let settings = {
  darkModeEnabled: false,
  mode: 'invert',
  blacklist: [],
  brightness: 100,
  contrast: 100,
  blueLightEnabled: false,
  forceDark: false,
  scheduleEnabled: false,
  startTime: '19:00',
  endTime: '07:00'
};

let observer = null;

function isBlacklisted() {
  const hostname = window.location.hostname;
  return settings.blacklist.some(domain => hostname.includes(domain));
}

function isAlreadyDark() {
  // If force dark is enabled, ignore native check
  if (settings.forceDark) return false;

  // Helper to get RGB from computed style
  function getRGB(el) {
    const style = window.getComputedStyle(el);
    const bgColor = style.backgroundColor;
    if (!bgColor) return null;
    
    // Handle transparent
    if (bgColor === 'transparent' || bgColor === 'rgba(0, 0, 0, 0)') return null;

    const rgb = bgColor.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      return { r: parseInt(rgb[0]), g: parseInt(rgb[1]), b: parseInt(rgb[2]) };
    }
    return null;
  }

  // Check brightness (0-255)
  function isDark(rgb) {
    if (!rgb) return false;
    // YIQ formula for brightness
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness < 128; // Standard threshold
  }

  const bodyRGB = getRGB(document.body);
  const htmlRGB = getRGB(document.documentElement);

  // If body has a color and it's dark
  if (bodyRGB && isDark(bodyRGB)) {
    chrome.runtime.sendMessage({ action: "nativeDarkDetected" });
    return true;
  }

  // If body is transparent but html is dark
  if (!bodyRGB && htmlRGB && isDark(htmlRGB)) {
    chrome.runtime.sendMessage({ action: "nativeDarkDetected" });
    return true;
  }

  // Fallback: Check prefers-color-scheme as a hint, but only if we couldn't determine color
  // or if the color found was ambiguous. 
  // Actually, if the user says "ignore native dark mode", we mostly care about visual darkness.
  // But some sites use images for background.
  
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // If we are here, it means background is likely light or transparent-default-white.
    // But if the site SAYS it supports dark mode, it might be using canvas or complex layers.
    // Let's check if there is a meta color-scheme
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta && meta.content.includes('dark')) {
       chrome.runtime.sendMessage({ action: "nativeDarkDetected" });
       return true;
    }
  }

  return false;
}

function checkSchedule() {
  if (!settings.scheduleEnabled) return settings.darkModeEnabled;

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();
  
  const [startH, startM] = settings.startTime.split(':').map(Number);
  const [endH, endM] = settings.endTime.split(':').map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;

  if (start < end) {
    return currentTime >= start && currentTime < end;
  } else {
    // Crosses midnight (e.g. 19:00 to 07:00)
    return currentTime >= start || currentTime < end;
  }
}

function updateDarkMode() {
  const shouldEnable = checkSchedule();
  
  // Remove existing styles first
  disableDarkMode();
  removeBlueLight();

  if (shouldEnable && !isBlacklisted()) {
    if (!isAlreadyDark()) {
      enableDarkMode();
    }
  }

  if (settings.blueLightEnabled) {
    applyBlueLight();
  }
}

function injectStyle(root, css) {
  let style = root.getElementById(styleId);
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    (root.head || root.documentElement || root).appendChild(style);
  }
  style.textContent = css;
}

function removeStyle(root) {
  const style = root.getElementById(styleId);
  if (style) {
    style.remove();
  }
}

function enableDarkMode() {
  let css = settings.mode === 'simple' ? cssSimple : cssInvert;
  
  // Apply Brightness/Contrast
  if (settings.mode === 'invert') {
    css = css.replace(
      'filter: invert(1) hue-rotate(180deg) !important;', 
      `filter: invert(1) hue-rotate(180deg) brightness(${settings.brightness}%) contrast(${settings.contrast}%) !important;`
    );
  } else {
    css += `
      html {
        filter: brightness(${settings.brightness}%) contrast(${settings.contrast}%) !important;
      }
    `;
  }

  injectStyle(document, css);
  applyToShadowRoots(document, css);

  if (!observer) {
    observer = new MutationObserver((mutations) => {
      if (document.getElementById(styleId)) return; // Exists
      
      const active = checkSchedule() && !isBlacklisted();
      if (active && !isAlreadyDark()) {
        injectStyle(document, css);
        applyToShadowRoots(document, css);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
}

function disableDarkMode() {
  removeStyle(document);
  removeFromShadowRoots(document);
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function applyBlueLight() {
  if (document.getElementById(blueLightId)) return;
  const div = document.createElement('div');
  div.id = blueLightId;
  div.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    background: rgba(255, 147, 41, 0.2);
    z-index: 2147483647;
    mix-blend-mode: multiply;
  `;
  document.documentElement.appendChild(div);
}

function removeBlueLight() {
  const div = document.getElementById(blueLightId);
  if (div) div.remove();
}

function applyToShadowRoots(root, css) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    { acceptNode: (node) => node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
  );
  while (walker.nextNode()) {
    const shadowRoot = walker.currentNode.shadowRoot;
    injectStyle(shadowRoot, css);
    applyToShadowRoots(shadowRoot, css);
  }
}

function removeFromShadowRoots(root) {
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    { acceptNode: (node) => node.shadowRoot ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
  );
  while (walker.nextNode()) {
    const shadowRoot = walker.currentNode.shadowRoot;
    removeStyle(shadowRoot);
    removeFromShadowRoots(shadowRoot);
  }
}

// Load settings
chrome.storage.local.get(null, (result) => {
  settings = { ...settings, ...result };
  updateDarkMode();
});

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "updateSettings" || request.action === "toggleDarkMode") {
    settings = { ...settings, ...request };
    updateDarkMode();
  } else if (request.action === "updateBlacklist") {
    settings.blacklist = request.blacklist;
    updateDarkMode();
  }
  sendResponse({ status: "ok" });
});
