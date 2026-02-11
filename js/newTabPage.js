const path = require('path')
const statistics = require('js/statistics.js')
const settings = require('util/settings/settings.js')
const tabEditor = require('navbar/tabEditor.js')
const searchbar = require('searchbar/searchbar.js')

const presetBackgrounds = Array.from({ length: 15 }, (_, index) => ({
  id: `preset-${index + 1}`,
  label: `Ambiance ${index + 1}`,
  src: `min://app/assets/backgrounds/bg-${String(index + 1).padStart(2, '0')}.svg`
}))

const customizationDefaults = {
  showGreeting: true,
  showActions: true,
  selectedPreset: 'random'
}

const newTabPage = {
  background: document.getElementById('ntp-background'),
  hasBackground: false,
  picker: document.getElementById('ntp-image-picker'),
  randomPicker: document.getElementById('ntp-image-random'),
  customizeToggle: document.getElementById('ntp-customize-toggle'),
  customizationPanel: document.getElementById('ntp-customization-panel'),
  showGreeting: document.getElementById('ntp-show-greeting'),
  showActions: document.getElementById('ntp-show-actions'),
  presetPicker: document.getElementById('ntp-background-select'),
  welcomeSection: document.getElementById('ntp-welcome'),
  quickActions: document.getElementById('ntp-quick-actions'),
  deleteBackground: document.getElementById('ntp-image-remove'),
  openFavorites: document.getElementById('ntp-open-favorites'),
  openHistory: document.getElementById('ntp-open-history'),
  openSettings: document.getElementById('ntp-open-settings'),
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  applyBackgroundSource: function (src, isFile = false) {
    if (newTabPage.blobInstance) {
      URL.revokeObjectURL(newTabPage.blobInstance)
      newTabPage.blobInstance = null
    }

    if (!src) {
      newTabPage.background.hidden = true
      newTabPage.hasBackground = false
      document.body.classList.remove('ntp-has-background')
      return
    }

    newTabPage.background.src = src
    newTabPage.background.hidden = false
    newTabPage.hasBackground = true
    document.body.classList.add('ntp-has-background')
    newTabPage.deleteBackground.hidden = !isFile
  },
  getCustomizationSettings: function () {
    const current = settings.get('newTabCustomization') || {}
    return Object.assign({}, customizationDefaults, current)
  },
  setCustomizationSettings: function (next) {
    settings.set('newTabCustomization', Object.assign({}, newTabPage.getCustomizationSettings(), next))
    newTabPage.renderFromSettings()
  },
  getPresetById: function (id) {
    return presetBackgrounds.find(bg => bg.id === id) || presetBackgrounds[0]
  },
  openBangShortcut: function (bang) {
    tabEditor.show(tabs.getSelected(), bang)
  },
  renderFromSettings: async function () {
    const custom = newTabPage.getCustomizationSettings()

    newTabPage.showGreeting.checked = custom.showGreeting
    newTabPage.showActions.checked = custom.showActions
    newTabPage.welcomeSection.querySelector('h1').hidden = !custom.showGreeting
    document.getElementById('ntp-subtitle').hidden = !custom.showGreeting
    newTabPage.quickActions.hidden = !custom.showActions

    const hasImportedImage = await fs.promises.access(newTabPage.imagePath).then(() => true).catch(() => false)

    if (hasImportedImage) {
      const data = await fs.promises.readFile(newTabPage.imagePath)
      const blob = new Blob([data], { type: 'application/octet-binary' })
      const url = URL.createObjectURL(blob)
      newTabPage.blobInstance = url
      newTabPage.applyBackgroundSource(url, true)
      newTabPage.presetPicker.value = 'uploaded'
      return
    }

    let presetId = custom.selectedPreset
    if (presetId === 'random') {
      const randomBackground = presetBackgrounds[Math.floor(Math.random() * presetBackgrounds.length)]
      presetId = randomBackground.id
    }

    const preset = newTabPage.getPresetById(presetId)
    newTabPage.applyBackgroundSource(preset.src)
    newTabPage.presetPicker.value = custom.selectedPreset
  },
  initializeBackgroundSelector: function () {
    const randomOption = document.createElement('option')
    randomOption.value = 'random'
    randomOption.textContent = 'Aléatoire (15 images)'
    newTabPage.presetPicker.appendChild(randomOption)

    const uploadedOption = document.createElement('option')
    uploadedOption.value = 'uploaded'
    uploadedOption.textContent = 'Image importée'
    uploadedOption.disabled = true
    newTabPage.presetPicker.appendChild(uploadedOption)

    presetBackgrounds.forEach((preset) => {
      const option = document.createElement('option')
      option.value = preset.id
      option.textContent = preset.label
      newTabPage.presetPicker.appendChild(option)
    })
  },
  initialize: function () {
    newTabPage.initializeBackgroundSelector()
    newTabPage.renderFromSettings()

    newTabPage.picker.addEventListener('click', async function () {
      var filePath = await ipc.invoke('showOpenDialog', {
        filters: [
          { name: 'Image files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
        ]
      })

      if (!filePath) {
        return
      }

      await fs.promises.copyFile(filePath[0], newTabPage.imagePath)
      newTabPage.presetPicker.value = 'uploaded'
      newTabPage.renderFromSettings()
    })

    newTabPage.randomPicker.addEventListener('click', function () {
      newTabPage.setCustomizationSettings({ selectedPreset: 'random' })
    })

    newTabPage.deleteBackground.addEventListener('click', async function () {
      await fs.promises.unlink(newTabPage.imagePath).catch(() => null)
      newTabPage.renderFromSettings()
    })

    newTabPage.customizeToggle.addEventListener('click', function () {
      newTabPage.customizationPanel.hidden = !newTabPage.customizationPanel.hidden
    })

    newTabPage.showGreeting.addEventListener('change', function () {
      newTabPage.setCustomizationSettings({ showGreeting: this.checked })
    })

    newTabPage.showActions.addEventListener('change', function () {
      newTabPage.setCustomizationSettings({ showActions: this.checked })
    })

    newTabPage.presetPicker.addEventListener('change', async function () {
      if (this.value === 'uploaded') {
        return
      }

      await fs.promises.unlink(newTabPage.imagePath).catch(() => null)
      newTabPage.setCustomizationSettings({ selectedPreset: this.value })
    })

    newTabPage.openFavorites.addEventListener('click', function () {
      newTabPage.openBangShortcut('!bookmarks ')
    })

    newTabPage.openHistory.addEventListener('click', function () {
      newTabPage.openBangShortcut('!history ')
    })

    newTabPage.openSettings.addEventListener('click', function () {
      searchbar.openURL('min://settings', null)
    })

    statistics.registerGetter('ntpHasBackground', function () {
      return newTabPage.hasBackground
    })
  }
}

module.exports = newTabPage
