const settings = require('util/settings/settings.js')

const modes = {
  standard: {
    name: 'Standard',
    blockNewTabs: false,
    muteAudio: false,
    className: ''
  },
  focus: {
    name: 'Focus',
    blockNewTabs: true,
    muteAudio: false,
    className: 'is-focus-mode'
  },
  gaming: {
    name: 'Gaming',
    blockNewTabs: false,
    muteAudio: true,
    className: 'is-gaming-mode'
  },
  study: {
    name: 'Study',
    blockNewTabs: true,
    muteAudio: true,
    className: 'is-study-mode'
  }
}

let currentMode = 'standard'

function setMode(modeName) {
  if (!modes[modeName]) {
    console.warn('Unknown mode:', modeName)
    return
  }

  // Remove previous mode classes
  Object.values(modes).forEach(m => {
    if (m.className) document.body.classList.remove(m.className)
  })

  currentMode = modeName
  const config = modes[modeName]

  // Add new mode class
  if (config.className) {
    document.body.classList.add(config.className)
  }

  // Apply configurations
  if (config.muteAudio) {
    // Mute all existing tabs
    if (window.tabs) { // check if tabs exist (renderer)
        tabs.get().forEach(tab => {
            // we can't easily import webviews here due to circular deps if not careful,
            // but focusMode.js is required by webviews.js? No, webviews.js requires focusMode.js.
            // So we can't require webviews.js here.
            // We'll rely on the class or send an event.
        })
        // Actually, we can dispatch an event
        window.dispatchEvent(new CustomEvent('mode-changed', { detail: { mode: modeName, config: config } }))
    }
  } else {
      window.dispatchEvent(new CustomEvent('mode-changed', { detail: { mode: modeName, config: config } }))
  }

  settings.set('currentMode', modeName)
}

// Initial load
settings.get('currentMode', (savedMode) => {
    if (savedMode && modes[savedMode]) {
        setMode(savedMode)
    }
})

ipc.on('setMode', function (e, mode) {
  setMode(mode)
})

ipc.on('enterFocusMode', function () {
  setMode('focus')
})

ipc.on('exitFocusMode', function () {
  setMode('standard')
})

module.exports = {
  enabled: function () {
    return modes[currentMode].blockNewTabs
  },
  getMode: function() {
    return currentMode
  },
  setMode: setMode,
  warn: function () {
    ipc.invoke('showFocusModeDialog2')
  }
}
