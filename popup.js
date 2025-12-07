document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('darkModeToggle');
  const status = document.getElementById('status');
  const modeSelect = document.getElementById('modeSelect');
  
  const brightness = document.getElementById('brightness');
  const brightnessVal = document.getElementById('brightnessVal');
  const contrast = document.getElementById('contrast');
  const contrastVal = document.getElementById('contrastVal');
  const blueLightToggle = document.getElementById('blueLightToggle');
  const forceDarkToggle = document.getElementById('forceDarkToggle');
  const nativeDarkStatus = document.getElementById('nativeDarkStatus');
  
  const scheduleToggle = document.getElementById('scheduleToggle');
  const scheduleInputs = document.getElementById('scheduleInputs');
  const startTime = document.getElementById('startTime');
  const endTime = document.getElementById('endTime');

  const blacklistInput = document.getElementById('blacklist');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  // Load saved state
  chrome.storage.local.get([
    'darkModeEnabled', 'mode', 'blacklist', 
    'brightness', 'contrast', 'blueLightEnabled', 'forceDark',
    'scheduleEnabled', 'startTime', 'endTime'
  ], (result) => {
    // Basic
    toggle.checked = result.darkModeEnabled || false;
    status.textContent = toggle.checked ? "On" : "Off";
    if (result.mode) modeSelect.value = result.mode;
    if (result.blacklist) blacklistInput.value = result.blacklist.join('\n');

    // Advanced
    if (result.brightness) {
      brightness.value = result.brightness;
      brightnessVal.textContent = result.brightness + '%';
    }
    if (result.contrast) {
      contrast.value = result.contrast;
      contrastVal.textContent = result.contrast + '%';
    }
    blueLightToggle.checked = result.blueLightEnabled || false;
    forceDarkToggle.checked = result.forceDark || false;

    // Schedule
    scheduleToggle.checked = result.scheduleEnabled || false;
    if (result.scheduleEnabled) scheduleInputs.classList.remove('hidden');
    if (result.startTime) startTime.value = result.startTime;
    if (result.endTime) endTime.value = result.endTime;
  });

  // Event Listeners
  toggle.addEventListener('change', updateState);
  modeSelect.addEventListener('change', updateState);
  
  brightness.addEventListener('input', () => {
    brightnessVal.textContent = brightness.value + '%';
    updateState();
  });
  
  contrast.addEventListener('input', () => {
    contrastVal.textContent = contrast.value + '%';
    updateState();
  });
  
  blueLightToggle.addEventListener('change', updateState);
  forceDarkToggle.addEventListener('change', updateState);

  scheduleToggle.addEventListener('change', () => {
    if (scheduleToggle.checked) {
      scheduleInputs.classList.remove('hidden');
    } else {
      scheduleInputs.classList.add('hidden');
    }
    updateState();
  });
  
  startTime.addEventListener('change', updateState);
  endTime.addEventListener('change', updateState);

  document.getElementById('resetSettings').addEventListener('click', () => {
    brightness.value = 100;
    brightnessVal.textContent = '100%';
    contrast.value = 100;
    contrastVal.textContent = '100%';
    blueLightToggle.checked = false;
    forceDarkToggle.checked = false;
    updateState();
  });

  function updateState() {
    const state = {
      darkModeEnabled: toggle.checked,
      mode: modeSelect.value,
      brightness: brightness.value,
      contrast: contrast.value,
      blueLightEnabled: blueLightToggle.checked,
      forceDark: forceDarkToggle.checked,
      scheduleEnabled: scheduleToggle.checked,
      startTime: startTime.value,
      endTime: endTime.value
    };

    status.textContent = state.darkModeEnabled ? "On" : "Off";

    // Save state
    chrome.storage.local.set(state);

    // Send message to active tab
    sendMessageToActiveTab({ action: "updateSettings", ...state });
  }

  saveBtn.addEventListener('click', () => {
    const domains = blacklistInput.value.split('\n').map(d => d.trim()).filter(d => d.length > 0);
    chrome.storage.local.set({ blacklist: domains }, () => {
      saveStatus.textContent = "Saved!";
      setTimeout(() => { saveStatus.textContent = ""; }, 2000);
      
      // Notify active tab about blacklist update
      sendMessageToActiveTab({ action: "updateBlacklist", blacklist: domains });
    });
  });

  function sendMessageToActiveTab(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab) return;

      if (tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("about:")) {
        return;
      }

      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          // Ignore
        }
      });
    });
  }

  // Listen for native dark detection
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "nativeDarkDetected") {
      nativeDarkStatus.classList.remove('hidden');
    }
  });
});
