const settings = require('util/settings/settings.js')
const webviews = require('webviews.js')

const modeDefaults = {
  standard: { muteAudio: false, darkMode: false },
  game: { muteAudio: true, darkMode: false },
  study: { muteAudio: true, darkMode: true }
}

function getModeSettings (mode) {
  const allModes = settings.get('displayModeOptions') || {}
  return allModes[mode] || modeDefaults[mode] || modeDefaults.standard
}

function applyModeToTabs (mode) {
  const config = getModeSettings(mode)
  tabs.get().forEach(function (tab) {
    if (!webviews.hasViewForTab(tab.id)) {
      return
    }
    webviews.callAsync(tab.id, 'setAudioMuted', !!config.muteAudio)
    tabs.update(tab.id, { muted: !!config.muteAudio })
  })

  settings.set('darkMode', config.darkMode ? 1 : 2)
  settings.set('displayMode', mode)
}

module.exports = {
  applyMode: applyModeToTabs
}
