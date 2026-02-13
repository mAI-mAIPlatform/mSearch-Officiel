document.title = l('settingsPreferencesHeading') + ' | Min'

var contentTypeBlockingContainer = document.getElementById('content-type-blocking')
var clearHistoryOnStartupCheckbox = document.getElementById('checkbox-clear-history-on-startup')
var banner = document.getElementById('restart-required-banner')
var siteThemeCheckbox = document.getElementById('checkbox-site-theme')
var showDividerCheckbox = document.getElementById('checkbox-show-divider')
var userscriptsCheckbox = document.getElementById('checkbox-userscripts')
var userscriptsShowDirectorySection = document.getElementById('userscripts-show-directory')
var separateTitlebarCheckbox = document.getElementById('checkbox-separate-titlebar')
var openTabsInForegroundCheckbox = document.getElementById('checkbox-open-tabs-in-foreground')
var autoPlayCheckbox = document.getElementById('checkbox-enable-autoplay')
var searchSuggestionsCheckbox = document.getElementById('checkbox-search-suggestions')
var searchSuggestionsCountInput = document.getElementById('input-search-suggestions-count')
var userAgentCheckbox = document.getElementById('checkbox-user-agent')
var userAgentInput = document.getElementById('input-user-agent')
var searchRegionSelect = document.getElementById('search-region')
var searchLanguageSelect = document.getElementById('search-language')
var searchSafeModeSelect = document.getElementById('search-safe-mode')
var searchExtraParamsInput = document.getElementById('search-extra-params')

var dynamicThemeCheckbox = document.getElementById('checkbox-dynamic-theme')
var liquidGlassAnimationsCheckbox = document.getElementById('checkbox-liquid-glass-animations')
var comfortReadingCheckbox = document.getElementById('checkbox-comfort-reading')
var fontSizeSlider = document.getElementById('font-size-slider')
var fontSizeValue = document.getElementById('font-size-value')
var fontSpacingSlider = document.getElementById('font-spacing-slider')
var fontSpacingValue = document.getElementById('font-spacing-value')
var multiViewMaxViewsInput = document.getElementById('multi-view-max-views')
var gestureShortcutsCheckbox = document.getElementById('checkbox-gesture-shortcuts')
var gestureWorkspaceCheckbox = document.getElementById('checkbox-gesture-workspace')
var openEphemeralTabButton = document.getElementById('button-open-ephemeral-tab')
var ntpRandomBackgroundCheckbox = document.getElementById('checkbox-ntp-random-background')
var ntpShortcutsSizeSelect = document.getElementById('select-ntp-shortcuts-size')
var ntpShowHistoryCheckbox = document.getElementById('checkbox-ntp-show-history')
var ntpShowFavoritesCheckbox = document.getElementById('checkbox-ntp-show-favorites')
var ntpFixTitleOverlapCheckbox = document.getElementById('checkbox-ntp-fix-title-overlap')

function showRestartRequiredBanner () {
  banner.hidden = false
  settings.set('restartNow', true)
}
settings.get('restartNow', (value) => {
  if (value === true) {
    showRestartRequiredBanner()
  }
})

/* content blocking settings */

var trackingLevelContainer = document.getElementById('tracking-level-container')
var trackingLevelOptions = Array.from(trackingLevelContainer.querySelectorAll('input[name=blockingLevel]'))
var blockingExceptionsContainer = document.getElementById('content-blocking-information')
var blockingExceptionsInput = document.getElementById('content-blocking-exceptions')
var blockedRequestCount = document.querySelector('#content-blocking-blocked-requests strong')

settings.listen('filteringBlockedCount', function (value) {
  var count = value || 0
  var valueStr
  if (count > 50000) {
    valueStr = new Intl.NumberFormat(navigator.locale, { notation: 'compact', maximumSignificantDigits: 4 }).format(count)
  } else {
    valueStr = new Intl.NumberFormat().format(count)
  }
  blockedRequestCount.textContent = valueStr
})

function updateBlockingLevelUI (level) {
  var radio = trackingLevelOptions[level]
  radio.checked = true

  if (level === 0) {
    blockingExceptionsContainer.hidden = true
  } else {
    blockingExceptionsContainer.hidden = false
    radio.parentNode.appendChild(blockingExceptionsContainer)
  }

  if (document.querySelector('#tracking-level-container .setting-option.selected')) {
    document.querySelector('#tracking-level-container .setting-option.selected').classList.remove('selected')
  }
  radio.parentNode.classList.add('selected')
}

function changeBlockingLevelSetting (level) {
  settings.get('filtering', function (value) {
    if (!value) {
      value = {}
    }
    value.blockingLevel = level
    settings.set('filtering', value)
    updateBlockingLevelUI(level)
  })
}

function setExceptionInputSize () {
  blockingExceptionsInput.style.height = (blockingExceptionsInput.scrollHeight + 2) + 'px'
}

settings.get('filtering', function (value) {
  // migrate from old settings (<v1.9.0)
  if (value && typeof value.trackers === 'boolean') {
    if (value.trackers === true) {
      value.blockingLevel = 2
    } else if (value.trackers === false) {
      value.blockingLevel = 0
    }
    delete value.trackers
    settings.set('filtering', value)
  }

  if (value && value.blockingLevel !== undefined) {
    updateBlockingLevelUI(value.blockingLevel)
  } else {
    updateBlockingLevelUI(1)
  }

  if (value && value.exceptionDomains && value.exceptionDomains.length > 0) {
    blockingExceptionsInput.value = value.exceptionDomains.join(', ') + ', '
    setExceptionInputSize()
  }
})

trackingLevelOptions.forEach(function (item, idx) {
  item.addEventListener('change', function () {
    changeBlockingLevelSetting(idx)
  })
})

blockingExceptionsInput.addEventListener('input', function () {
  setExceptionInputSize()

  // remove protocols because of https://github.com/minbrowser/min/issues/1428
  var newValue = this.value.split(',').map(i => i.trim().replace('http://', '').replace('https://', '')).filter(i => !!i)

  settings.get('filtering', function (value) {
    if (!value) {
      value = {}
    }
    value.exceptionDomains = newValue
    settings.set('filtering', value)
  })
})

/* content type settings */

var contentTypes = {
  // humanReadableName: contentType
  scripts: 'script',
  images: 'image'
}

// used for showing localized strings
var contentTypeSettingNames = {
  scripts: 'settingsBlockScriptsToggle',
  images: 'settingsBlockImagesToggle'
}

for (var contentType in contentTypes) {
  (function (contentType) {
    settings.get('filtering', function (value) {
      // create the settings section for blocking each content type

      var section = document.createElement('div')
      section.classList.add('setting-section')

      var id = 'checkbox-block-' + contentTypes[contentType]

      var checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.id = id

      if (value && value.contentTypes) {
        checkbox.checked = value.contentTypes.indexOf(contentTypes[contentType]) != -1
      }

      var label = document.createElement('label')
      label.setAttribute('for', id)
      label.textContent = l(contentTypeSettingNames[contentType])

      section.appendChild(checkbox)
      section.appendChild(label)

      contentTypeBlockingContainer.appendChild(section)

      checkbox.addEventListener('change', function (e) {
        settings.get('filtering', function (value) {
          if (!value) {
            value = {}
          }
          if (!value.contentTypes) {
            value.contentTypes = []
          }

          if (e.target.checked) { // add the item to the array
            value.contentTypes.push(contentTypes[contentType])
          } else { // remove the item from the array
            var idx = value.contentTypes.indexOf(contentTypes[contentType])
            value.contentTypes.splice(idx, 1)
          }

          settings.set('filtering', value)
        })
      })
    })
  })(contentType)
}

/* clear history on startup setting */

settings.get('clearHistoryOnStartup', function (value) {
  if (value === true) {
    clearHistoryOnStartupCheckbox.checked = true
  }
})

clearHistoryOnStartupCheckbox.addEventListener('change', function (e) {
  settings.set('clearHistoryOnStartup', this.checked)
})

/* dark mode setting */
var darkModeNever = document.getElementById('dark-mode-never')
var darkModeNight = document.getElementById('dark-mode-night')
var darkModeAlways = document.getElementById('dark-mode-always')
var darkModeSystem = document.getElementById('dark-mode-system')

// -1 - off ; 0 - auto ; 1 - on
settings.get('darkMode', function (value) {
  darkModeNever.checked = (value === -1)
  darkModeNight.checked = (value === 0)
  darkModeAlways.checked = (value === 1 || value === true)
  darkModeSystem.checked = (value === 2 || value === undefined || value === false)
})

darkModeNever.addEventListener('change', function (e) {
  if (this.checked) {
    settings.set('darkMode', -1)
  }
})
darkModeNight.addEventListener('change', function (e) {
  if (this.checked) {
    settings.set('darkMode', 0)
  }
})
darkModeAlways.addEventListener('change', function (e) {
  if (this.checked) {
    settings.set('darkMode', 1)
  }
})
darkModeSystem.addEventListener('change', function (e) {
  if (this.checked) {
    settings.set('darkMode', 2)
  }
})

/* site theme setting */

settings.get('siteTheme', function (value) {
  if (value === true || value === undefined) {
    siteThemeCheckbox.checked = true
  } else {
    siteThemeCheckbox.checked = false
  }
})

siteThemeCheckbox.addEventListener('change', function (e) {
  settings.set('siteTheme', this.checked)
})

/* startup settings */

var startupSettingInput = document.getElementById('startup-options')

settings.get('startupTabOption', function (value = 2) {
  startupSettingInput.value = value
})

startupSettingInput.addEventListener('change', function () {
  settings.set('startupTabOption', parseInt(this.value))
})

/* new window settings */

var newWindowSettingInput = document.getElementById('new-window-options')

settings.get('newWindowOption', function (value = 1) {
  newWindowSettingInput.value = value
})

newWindowSettingInput.addEventListener('change', function () {
  settings.set('newWindowOption', parseInt(this.value))
})

/* userscripts setting */

settings.get('userscriptsEnabled', function (value) {
  if (value === true) {
    userscriptsCheckbox.checked = true
    userscriptsShowDirectorySection.hidden = false
  }
})

userscriptsCheckbox.addEventListener('change', function (e) {
  settings.set('userscriptsEnabled', this.checked)
  userscriptsShowDirectorySection.hidden = !this.checked
})

userscriptsShowDirectorySection.getElementsByTagName('a')[0].addEventListener('click', function () {
  postMessage({ message: 'showUserscriptDirectory' })
})

/* show divider between tabs setting */

settings.get('showDividerBetweenTabs', function (value) {
  if (value === true) {
    showDividerCheckbox.checked = true
  }
})

showDividerCheckbox.addEventListener('change', function (e) {
  settings.set('showDividerBetweenTabs', this.checked)
})

/* language setting */

var languagePicker = document.getElementById('setting-language-picker')

for (var language in languages) { // from localization.build.js
  var item = document.createElement('option')
  item.textContent = languages[language].name
  item.value = languages[language].identifier
  languagePicker.appendChild(item)
}

languagePicker.value = getCurrentLanguage()

languagePicker.addEventListener('change', function () {
  settings.set('userSelectedLanguage', this.value)
  showRestartRequiredBanner()
})

/* separate titlebar setting */

settings.get('useSeparateTitlebar', function (value) {
  if (value === true) {
    separateTitlebarCheckbox.checked = true
  }
})

separateTitlebarCheckbox.addEventListener('change', function (e) {
  settings.set('useSeparateTitlebar', this.checked)
  showRestartRequiredBanner()
})

/* tabs in foreground setting */

settings.get('openTabsInForeground', function (value) {
  if (value === true) {
    openTabsInForegroundCheckbox.checked = true
  }
})

openTabsInForegroundCheckbox.addEventListener('change', function (e) {
  settings.set('openTabsInForeground', this.checked)
})

/* media autoplay setting */

settings.get('enableAutoplay', function (value) {
  autoPlayCheckbox.checked = value
})

autoPlayCheckbox.addEventListener('change', function (e) {
  settings.set('enableAutoplay', this.checked)
})

/* search suggestions settings */

settings.get('searchSuggestionsEnabled', function (value) {
  if (value === false) {
    searchSuggestionsCheckbox.checked = false
  } else {
    searchSuggestionsCheckbox.checked = true
  }
})

searchSuggestionsCheckbox.addEventListener('change', function () {
  settings.set('searchSuggestionsEnabled', this.checked)
})

settings.get('searchSuggestionsCount', function (value) {
  var parsedValue = Number.parseInt(value, 10)

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 8) {
    parsedValue = 3
  }

  searchSuggestionsCountInput.value = parsedValue

  if (parsedValue !== value) {
    settings.set('searchSuggestionsCount', parsedValue)
  }
})

searchSuggestionsCountInput.addEventListener('change', function () {
  var parsedValue = Number.parseInt(this.value, 10)

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    parsedValue = 1
  } else if (parsedValue > 8) {
    parsedValue = 8
  }

  this.value = parsedValue
  settings.set('searchSuggestionsCount', parsedValue)
})

/* user agent settting */

settings.get('customUserAgent', function (value) {
  if (value) {
    userAgentCheckbox.checked = true
    userAgentInput.style.visibility = 'visible'
    userAgentInput.value = value
  }
})

userAgentCheckbox.addEventListener('change', function (e) {
  if (this.checked) {
    userAgentInput.style.visibility = 'visible'
  } else {
    settings.set('customUserAgent', null)
    userAgentInput.style.visibility = 'hidden'
    showRestartRequiredBanner()
  }
})

userAgentInput.addEventListener('input', function (e) {
  const value = this.value.slice(0, 200)
  if (value !== this.value) {
    this.value = value
  }
  if (value) {
    settings.set('customUserAgent', value)
  } else {
    settings.set('customUserAgent', null)
  }
  showRestartRequiredBanner()
})

/* multi-view and gesture settings */

settings.get('multiViewMaxViews', function (value) {
  multiViewMaxViewsInput.value = String(value || 1)
})

multiViewMaxViewsInput.addEventListener('change', function () {
  settings.set('multiViewMaxViews', parseInt(this.value) || 1)
})

settings.get('gestureShortcutsEnabled', function (value) {
  gestureShortcutsCheckbox.checked = value === true
})

gestureShortcutsCheckbox.addEventListener('change', function () {
  settings.set('gestureShortcutsEnabled', this.checked)
})

settings.get('gestureWorkspaceSwipeEnabled', function (value) {
  gestureWorkspaceCheckbox.checked = value !== false
})

gestureWorkspaceCheckbox.addEventListener('change', function () {
  settings.set('gestureWorkspaceSwipeEnabled', this.checked)
})

openEphemeralTabButton.addEventListener('click', function () {
  postMessage({ message: 'open-ephemeral-tab', url: 'min://newtab' })
})

settings.get('ntpRandomBackgroundEnabled', function (value) {
  ntpRandomBackgroundCheckbox.checked = value !== false
})

ntpRandomBackgroundCheckbox.addEventListener('change', function () {
  settings.set('ntpRandomBackgroundEnabled', this.checked)
})

settings.get('ntpMaxShortcuts', function (value) {
  var safe = parseInt(value, 10)
  if (![4, 6, 8].includes(safe)) {
    safe = 8
  }
  ntpShortcutsSizeSelect.value = String(safe)
})

ntpShortcutsSizeSelect.addEventListener('change', function () {
  var safe = parseInt(this.value, 10)
  if (![4, 6, 8].includes(safe)) {
    safe = 8
  }
  settings.set('ntpMaxShortcuts', safe)
})

settings.get('ntpShowHistory', function (value) {
  ntpShowHistoryCheckbox.checked = value !== false
})

ntpShowHistoryCheckbox.addEventListener('change', function () {
  settings.set('ntpShowHistory', this.checked)
})

settings.get('ntpShowFavorites', function (value) {
  ntpShowFavoritesCheckbox.checked = value !== false
})

ntpShowFavoritesCheckbox.addEventListener('change', function () {
  settings.set('ntpShowFavorites', this.checked)
})

settings.get('ntpFixTitleOverlap', function (value) {
  ntpFixTitleOverlapCheckbox.checked = value !== false
})

ntpFixTitleOverlapCheckbox.addEventListener('change', function () {
  settings.set('ntpFixTitleOverlap', this.checked)
})

/* dynamic theme, animations and font preferences */

function updateFontDisplay () {
  fontSizeValue.textContent = (parseInt(fontSizeSlider.value) || 100) + '%'
  fontSpacingValue.textContent = (parseFloat(fontSpacingSlider.value) || 0).toFixed(2) + 'px'
}

settings.get('dynamicThemeEnabled', function (value) {
  dynamicThemeCheckbox.checked = value === true
})

dynamicThemeCheckbox.addEventListener('change', function () {
  settings.set('dynamicThemeEnabled', this.checked)
})

settings.get('liquidGlassAnimations', function (value) {
  liquidGlassAnimationsCheckbox.checked = value !== false
})

liquidGlassAnimationsCheckbox.addEventListener('change', function () {
  settings.set('liquidGlassAnimations', this.checked)
})

settings.get('comfortReadingMode', function (value) {
  comfortReadingCheckbox.checked = value === true
})

comfortReadingCheckbox.addEventListener('change', function () {
  settings.set('comfortReadingMode', this.checked)
})

settings.get('uiFontScale', function (value) {
  fontSizeSlider.value = String(value || 100)
  updateFontDisplay()
})

fontSizeSlider.addEventListener('input', function () {
  settings.set('uiFontScale', parseInt(this.value) || 100)
  updateFontDisplay()
})

settings.get('uiLetterSpacing', function (value) {
  var parsed = typeof value === 'number' ? value : 0
  fontSpacingSlider.value = String(parsed)
  updateFontDisplay()
})

fontSpacingSlider.addEventListener('input', function () {
  settings.set('uiLetterSpacing', parseFloat(this.value) || 0)
  updateFontDisplay()
})

/* update notifications setting */

var updateNotificationsCheckbox = document.getElementById('checkbox-update-notifications')

settings.get('updateNotificationsEnabled', function (value) {
  if (value === false) {
    updateNotificationsCheckbox.checked = false
  } else {
    updateNotificationsCheckbox.checked = true
  }
})

updateNotificationsCheckbox.addEventListener('change', function (e) {
  settings.set('updateNotificationsEnabled', this.checked)
})

/* mAI sidebar setting */

var maiSidebarEnabledCheckbox = document.getElementById('checkbox-mai-sidebar-enabled')

settings.get('maiSidebarEnabled', function (value) {
  if (value === false) {
    maiSidebarEnabledCheckbox.checked = false
  } else {
    maiSidebarEnabledCheckbox.checked = true
  }
})

maiSidebarEnabledCheckbox.addEventListener('change', function (e) {
  settings.set('maiSidebarEnabled', this.checked)
})

/* usage statistics setting */

var usageStatisticsCheckbox = document.getElementById('checkbox-usage-statistics')

settings.get('collectUsageStats', function (value) {
  if (value === false) {
    usageStatisticsCheckbox.checked = false
  } else {
    usageStatisticsCheckbox.checked = true
  }
})

usageStatisticsCheckbox.addEventListener('change', function (e) {
  settings.set('collectUsageStats', this.checked)
})

/* default search engine setting */

var searchEngineDropdown = document.getElementById('default-search-engine')
var searchEngineInput = document.getElementById('custom-search-engine')

function normalizeSearchEngineOptions (value) {
  var defaults = {
    region: 'fr-FR',
    language: 'fr',
    safeMode: 'moderate',
    extraParams: ''
  }

  if (!value || typeof value !== 'object') {
    return defaults
  }

  return {
    region: value.region || defaults.region,
    language: value.language || defaults.language,
    safeMode: value.safeMode || defaults.safeMode,
    extraParams: typeof value.extraParams === 'string' ? value.extraParams.trim() : ''
  }
}

function saveSearchEngineOptions () {
  settings.set('searchEngineOptions', {
    region: searchRegionSelect.value,
    language: searchLanguageSelect.value,
    safeMode: searchSafeModeSelect.value,
    extraParams: (searchExtraParamsInput.value || '').trim()
  })
}

searchEngineInput.setAttribute('placeholder', l('customSearchEngineDescription'))

settings.onLoad(function () {
  const activeEngine = currentSearchEngine && currentSearchEngine.name ? currentSearchEngine.name : 'DuckDuckGo'

  if (currentSearchEngine.custom) {
    searchEngineInput.hidden = false
    searchEngineInput.value = currentSearchEngine.searchURL
    searchEngineDropdown.value = 'custom'
  }

  const optionsFragment = document.createDocumentFragment()

  for (var searchEngine in searchEngines) {
    var item = document.createElement('option')
    item.value = searchEngines[searchEngine].name
    item.textContent = searchEngines[searchEngine].name

    if (!currentSearchEngine.custom && searchEngines[searchEngine].name === activeEngine) {
      item.setAttribute('selected', 'true')
    }

    optionsFragment.appendChild(item)
  }

  // add custom option
  item = document.createElement('option')
  item.value = 'custom'
  item.textContent = 'Personnalisé'
  if (currentSearchEngine.custom) {
    item.setAttribute('selected', 'true')
  }
  optionsFragment.appendChild(item)

  searchEngineDropdown.appendChild(optionsFragment)

  settings.get('searchEngine', function (value) {
    if (value && value.name) {
      searchEngineDropdown.value = value.name
      searchEngineInput.hidden = true
    }

    if (value && value.url) {
      searchEngineDropdown.value = 'custom'
      searchEngineInput.hidden = false
      searchEngineInput.value = value.url
    }
  })
})

settings.get('searchEngineOptions', function (value) {
  var safeOptions = normalizeSearchEngineOptions(value)
  searchRegionSelect.value = safeOptions.region
  searchLanguageSelect.value = safeOptions.language
  searchSafeModeSelect.value = safeOptions.safeMode
  searchExtraParamsInput.value = safeOptions.extraParams
})

searchEngineDropdown.addEventListener('change', function () {
  if (this.value === 'custom') {
    searchEngineInput.hidden = false
  } else {
    searchEngineInput.hidden = true
    settings.set('searchEngine', { name: this.value })
  }
})

searchEngineInput.addEventListener('input', function () {
  settings.set('searchEngine', { url: this.value })
})

searchRegionSelect.addEventListener('change', saveSearchEngineOptions)
searchLanguageSelect.addEventListener('change', saveSearchEngineOptions)
searchSafeModeSelect.addEventListener('change', saveSearchEngineOptions)
searchExtraParamsInput.addEventListener('input', saveSearchEngineOptions)

/* key map settings */

settings.get('keyMap', function (keyMapSettings) {
  var keyMap = userKeyMap(keyMapSettings)

  var keyMapList = document.getElementById('key-map-list')

  Object.keys(keyMap).forEach(function (action) {
    var li = createKeyMapListItem(action, keyMap)
    keyMapList.appendChild(li)
  })
})

function formatCamelCase (text) {
  var result = text.replace(/([a-z])([A-Z])/g, '$1 $2')
  return result.charAt(0).toUpperCase() + result.slice(1)
}

function createKeyMapListItem (action, keyMap) {
  var li = document.createElement('li')
  var label = document.createElement('label')
  var input = document.createElement('input')
  label.innerText = formatCamelCase(action)
  label.htmlFor = action

  input.type = 'text'
  input.id = input.name = action
  input.value = formatKeyValue(keyMap[action])
  input.addEventListener('input', onKeyMapChange)

  li.appendChild(label)
  li.appendChild(input)

  return li
}

function formatKeyValue (value) {
  // multiple shortcuts should be separated by commas
  if (value instanceof Array) {
    value = value.join(', ')
  }
  // use either command or ctrl depending on the platform
  if (navigator.platform === 'MacIntel') {
    value = value.replace(/\bmod\b/g, 'command')
  } else {
    value = value.replace(/\bmod\b/g, 'ctrl')
    value = value.replace(/\boption\b/g, 'alt')
  }
  if (navigator.platform === 'Win32') {
    value = value.replace(/\bsuper\b/g, 'win')
  }
  return value
}

function parseKeyInput (input) {
  // input may be a single mapping or multiple mappings comma separated.
  var parsed = input.toLowerCase().split(',')
  parsed = parsed.map(function (e) { return e.trim() })
  // Remove empty
  parsed = parsed.filter(Boolean)
  // convert key names back to generic equivalents
  parsed = parsed.map(function (e) {
    if (navigator.platform === 'MacIntel') {
      e = e.replace(/\b(command)|(cmd)\b/g, 'mod')
    } else {
      e = e.replace(/\b(control)|(ctrl)\b/g, 'mod')
      e = e.replace(/\balt\b/g, 'option')
      e = e.replace(/\bwin\b/g, 'super')
    }
    return e
  })
  return parsed.length > 1 ? parsed : parsed[0]
}

function onKeyMapChange (e) {
  var action = this.name
  var newValue = this.value

  settings.get('keyMap', function (keyMapSettings) {
    if (!keyMapSettings) {
      keyMapSettings = {}
    }

    keyMapSettings[action] = parseKeyInput(newValue)
    settings.set('keyMap', keyMapSettings)
    showRestartRequiredBanner()
  })
}

/* Password auto-fill settings  */

var passwordManagersDropdown = document.getElementById('selected-password-manager')
for (var manager in passwordManagers) {
  var item = document.createElement('option')
  item.textContent = passwordManagers[manager].name
  passwordManagersDropdown.appendChild(item)
}

settings.listen('passwordManager', function (value) {
  passwordManagersDropdown.value = currentPasswordManager.name
})

passwordManagersDropdown.addEventListener('change', function (e) {
  if (this.value === 'none') {
    settings.set('passwordManager', { name: 'none' })
  } else {
    settings.set('passwordManager', { name: this.value })
  }
})

var keychainViewLink = document.getElementById('keychain-view-link')

keychainViewLink.addEventListener('click', function () {
  postMessage({ message: 'showCredentialList' })
})

settings.listen('passwordManager', function (value) {
  keychainViewLink.hidden = !(currentPasswordManager.name === 'Built-in password manager')
})

/* proxy settings */

const proxyTypeInput = document.getElementById('selected-proxy-type')
const proxyInputs = Array.from(document.querySelectorAll('#proxy-settings-container input'))

const toggleProxyOptions = proxyType => {
  document.getElementById('manual-proxy-section').hidden = proxyType != 1
  document.getElementById('pac-option').hidden = proxyType != 2
}

const setProxy = (key, value) => {
  settings.get('proxy', (proxy = {}) => {
    proxy[key] = value
    settings.set('proxy', proxy)
  })
}

settings.get('proxy', (proxy = {}) => {
  toggleProxyOptions(proxy.type)

  proxyTypeInput.options.selectedIndex = proxy.type || 0
  proxyInputs.forEach(item => item.value = proxy[item.name] || '')
})

proxyTypeInput.addEventListener('change', e => {
  const proxyType = e.target.options.selectedIndex
  setProxy('type', proxyType)
  toggleProxyOptions(proxyType)
})

proxyInputs.forEach(item => item.addEventListener('change', e => setProxy(e.target.name, e.target.value)))

settings.get('customBangs', (value) => {
  const bangslist = document.getElementById('custom-bangs')

  if (value) {
    value.forEach(function (bang) {
      bangslist.appendChild(createBang(bang.phrase, bang.snippet, bang.redirect))
    })
  }
})

document.getElementById('add-custom-bang').addEventListener('click', function () {
  const bangslist = document.getElementById('custom-bangs')
  const newListItem = createBang()
  bangslist.appendChild(newListItem)
  document.body.scrollBy(0, Math.round(newListItem.getBoundingClientRect().height))
})

function createBang (bang, snippet, redirect) {
  var li = document.createElement('li')
  var bangInput = document.createElement('input')
  var snippetInput = document.createElement('input')
  var redirectInput = document.createElement('input')
  var xButton = document.createElement('button')
  var current = { phrase: bang ?? '', snippet: snippet ?? '', redirect: redirect ?? '' }
  function update (key, input) {
    settings.get('customBangs', function (d) {
      const filtered = d ? d.filter((bang) => bang.phrase !== current.phrase && (key !== 'phrase' || bang.phrase !== input.value)) : []
      filtered.push({ phrase: bangInput.value, snippet: snippetInput.value, redirect: redirectInput.value })
      settings.set('customBangs', filtered)
      current[key] = input.value
    })
  }

  bangInput.type = 'text'
  snippetInput.type = 'text'
  redirectInput.type = 'text'
  bangInput.value = bang ?? ''
  snippetInput.value = snippet ?? ''
  redirectInput.value = redirect ?? ''
  xButton.className = 'i carbon:close custom-bang-delete-button'

  bangInput.placeholder = l('settingsCustomBangsPhrase')
  snippetInput.placeholder = l('settingsCustomBangsSnippet')
  redirectInput.placeholder = l('settingsCustomBangsRedirect')
  xButton.addEventListener('click', function () {
    li.remove()
    settings.get('customBangs', (d) => {
      settings.set('customBangs', d.filter((bang) => bang.phrase !== bangInput.value))
    })
    showRestartRequiredBanner()
  })

  bangInput.addEventListener('change', function () {
    if (this.value.startsWith('!')) {
      this.value = this.value.slice(1)
    }
    update('phrase', bangInput)
    showRestartRequiredBanner()
  })
  snippetInput.addEventListener('change', function () {
    update('snippet', snippetInput)
    showRestartRequiredBanner()
  })
  redirectInput.addEventListener('change', function () {
    update('redirect', redirectInput)
    showRestartRequiredBanner()
  })

  li.appendChild(bangInput)
  li.appendChild(snippetInput)
  li.appendChild(redirectInput)
  li.appendChild(xButton)

  return li
}
