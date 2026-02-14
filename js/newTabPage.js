const fs = require('fs')
const path = require('path')
const statistics = require('js/statistics.js')
const places = require('places/places.js')
const searchbar = require('searchbar/searchbar.js')
const tabEditor = require('navbar/tabEditor.js')
const settings = require('util/settings/settings.js')

const REMINDER_STORAGE_KEY = 'msearch.ntp.reminders'
const THEME_STORAGE_KEY = 'msearch.ntp.theme'
const RANDOM_BG_STORAGE_KEY = 'msearch.ntp.randomBackground'
const DENSITY_STORAGE_KEY = 'msearch.ntp.density'
const GLASS_STORAGE_KEY = 'msearch.ntp.glass'
const SHOW_WIDGETS_STORAGE_KEY = 'msearch.ntp.showWidgets'
const SHOW_FAVORITES_STORAGE_KEY = 'msearch.ntp.showFavorites'
const SHOW_HISTORY_STORAGE_KEY = 'msearch.ntp.showHistory'
const MAI_SIDEBAR_STORAGE_KEY = 'msearch.ntp.maiSidebarOpen'
const MAX_REMINDERS = 12

const themes = {
  aurora: 'linear-gradient(120deg, rgba(49, 87, 255, 0.45), rgba(65, 230, 180, 0.25), rgba(203, 124, 255, 0.35))',
  ocean: 'linear-gradient(120deg, rgba(6, 80, 204, 0.5), rgba(44, 167, 210, 0.25), rgba(15, 42, 100, 0.45))',
  sunset: 'linear-gradient(120deg, rgba(232, 124, 32, 0.5), rgba(222, 80, 130, 0.35), rgba(103, 34, 167, 0.4))'
}

const baseBackgrounds = Array.from({ length: 35 }, function (_, index) {
  return `https://picsum.photos/seed/msearch-bg-${index + 1}/1920/1080`
})

// Backgrounds clairs supplémentaires (ciels, plages, soleil) pour une ambiance plus lumineuse.
const brightBackgroundSeeds = [
  'bright-sky-01',
  'bright-sky-02',
  'bright-sky-03',
  'bright-sky-04',
  'bright-sky-05',
  'bright-sky-06',
  'bright-sky-07',
  'bright-sky-08',
  'bright-sky-09',
  'bright-sky-10',
  'bright-beach-01',
  'bright-beach-02',
  'bright-beach-03',
  'bright-beach-04',
  'bright-beach-05',
  'bright-beach-06',
  'bright-beach-07',
  'bright-beach-08',
  'bright-beach-09',
  'bright-beach-10',
  'bright-sunrise-01',
  'bright-sunrise-02',
  'bright-sunrise-03',
  'bright-sunrise-04',
  'bright-sunrise-05',
  'bright-sunrise-06',
  'bright-sunrise-07',
  'bright-sunrise-08',
  'bright-sunrise-09',
  'bright-sunrise-10',
  'bright-lagoon-01',
  'bright-lagoon-02',
  'bright-lagoon-03',
  'bright-lagoon-04',
  'bright-lagoon-05',
  'bright-lagoon-06',
  'bright-lagoon-07',
  'bright-lagoon-08',
  'bright-lagoon-09',
  'bright-lagoon-10',
  'bright-clouds-01',
  'bright-clouds-02',
  'bright-clouds-03',
  'bright-clouds-04',
  'bright-clouds-05',
  'bright-clouds-06',
  'bright-clouds-07',
  'bright-clouds-08',
  'bright-clouds-09',
  'bright-clouds-10',
  'bright-summer-01',
  'bright-summer-02',
  'bright-summer-03',
  'bright-summer-04',
  'bright-summer-05',
  'bright-summer-06',
  'bright-summer-07',
  'bright-summer-08',
  'bright-summer-09',
  'bright-summer-10',
  'bright-horizon-01',
  'bright-horizon-02',
  'bright-horizon-03',
  'bright-horizon-04',
  'bright-horizon-05',
  'nature-forest-01',
  'nature-forest-02',
  'nature-forest-03',
  'nature-mountains-01',
  'nature-mountains-02',
  'nature-mountains-03',
  'city-night-01',
  'city-night-02',
  'city-night-03',
  'abstract-art-01',
  'abstract-art-02',
  'abstract-art-03'
]

const curatedBackgrounds = baseBackgrounds.concat(brightBackgroundSeeds.map(function (seed) {
  return `https://picsum.photos/seed/msearch-${seed}/1920/1080`
}))

const newTabPage = {
  background: document.getElementById('ntp-background'),
  backgroundOverlay: document.getElementById('ntp-gradient-overlay'),
  hasBackground: false,
  picker: document.getElementById('ntp-image-picker'),
  randomBackgroundButton: document.getElementById('ntp-image-random'),
  deleteBackground: document.getElementById('ntp-image-remove'),
  themeSelector: document.getElementById('ntp-theme-selector'),
  reminderForm: document.getElementById('ntp-reminder-form'),
  reminderInput: document.getElementById('ntp-reminder-input'),
  reminderList: document.getElementById('ntp-reminder-list'),
  favoritesList: document.getElementById('ntp-favorites-list'),
  historyList: document.getElementById('ntp-history-list'),
  searchForm: document.getElementById('ntp-search-form'),
  searchInput: document.getElementById('ntp-search-input'),
  subtitle: document.getElementById('ntp-subtitle'),
  dateOutput: document.getElementById('ntp-date'),
  timeOutput: document.getElementById('ntp-time'),
  actionButtons: document.querySelectorAll('#ntp-quick-actions [data-ntp-action], #ntp-widget-grid [data-ntp-action]'),
  widgetsPanel: document.getElementById('ntp-widgets-panel'),
  favoritesPanel: document.getElementById('ntp-favorites-panel'),
  historyPanel: document.getElementById('ntp-history-panel'),
  personalizationPanel: document.getElementById('ntp-personalization-panel'),
  densitySelector: document.getElementById('ntp-density-selector'),
  glassSelector: document.getElementById('ntp-glass-selector'),
  toggleWidgets: document.getElementById('ntp-toggle-widgets'),
  toggleFavorites: document.getElementById('ntp-toggle-favorites'),
  toggleHistory: document.getElementById('ntp-toggle-history'),
  maiSidebar: document.getElementById('ntp-mai-sidebar'),
  maiToggleButton: document.getElementById('ntp-mai-toggle'),
  maiNewChatButton: document.getElementById('ntp-mai-new-chat'),
  maiIframe: document.getElementById('ntp-mai-iframe'),
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  reminders: [],
  clockTimer: null,
  historyRefreshTimer: null,
  isMaiSidebarOpen: false,
  setBackgroundVisualState: function (hasBackground) {
    if (!newTabPage.background || !newTabPage.deleteBackground || !newTabPage.backgroundOverlay) {
      return
    }

    newTabPage.background.hidden = !hasBackground
    newTabPage.hasBackground = hasBackground
    document.body.classList.toggle('ntp-has-background', hasBackground)
    newTabPage.deleteBackground.hidden = !hasBackground

    if (hasBackground) {
      newTabPage.backgroundOverlay.style.backgroundImage = 'linear-gradient(120deg, rgba(11, 14, 23, 0.35), rgba(17, 24, 39, 0.58))'
      return
    }

    newTabPage.backgroundOverlay.style.backgroundImage = themes[newTabPage.getSelectedTheme()]
  },
  setBackgroundSource: function (source) {
    if (!newTabPage.background || !source) {
      return
    }

    const target = newTabPage.background
    const fallbackSrc = target.src

    target.onload = function () {
      target.onload = null
      target.onerror = null
      newTabPage.setBackgroundVisualState(true)
    }

    target.onerror = function () {
      target.onload = null
      target.onerror = null

      if (fallbackSrc && fallbackSrc !== source) {
        target.src = fallbackSrc
      } else {
        newTabPage.setBackgroundVisualState(false)
      }
    }

    target.src = source
  },
  getSelectedTheme: function () {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    if (storedTheme && themes[storedTheme]) {
      return storedTheme
    }
    return 'aurora'
  },
  applyTheme: function (themeId) {
    const safeTheme = themes[themeId] ? themeId : 'aurora'
    document.body.setAttribute('data-ntp-theme', safeTheme)
    localStorage.setItem(THEME_STORAGE_KEY, safeTheme)
    if (newTabPage.themeSelector) {
      newTabPage.themeSelector.value = safeTheme
    }

    if (!newTabPage.hasBackground && newTabPage.backgroundOverlay) {
      newTabPage.backgroundOverlay.style.backgroundImage = themes[safeTheme]
    }
  },
  loadReminders: function () {
    try {
      const raw = localStorage.getItem(REMINDER_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) {
        newTabPage.reminders = parsed.filter(item => item && typeof item.text === 'string').slice(0, MAX_REMINDERS)
      } else {
        newTabPage.reminders = []
      }
    } catch (e) {
      newTabPage.reminders = []
    }
  },
  saveReminders: function () {
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(newTabPage.reminders.slice(0, MAX_REMINDERS)))
  },
  normalizeURL: function (value) {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }

    if (trimmed.includes('://') || trimmed.startsWith('about:') || trimmed.startsWith('min:')) {
      return trimmed
    }

    if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) {
      return 'https://' + trimmed
    }

    return trimmed
  },
  renderReminders: function () {
    if (!newTabPage.reminderList) {
      return
    }

    newTabPage.reminderList.textContent = ''

    if (newTabPage.reminders.length === 0) {
      const emptyState = document.createElement('li')
      emptyState.className = 'ntp-empty-state'
      emptyState.textContent = 'Aucun rappel pour le moment.'
      newTabPage.reminderList.appendChild(emptyState)
      return
    }

    const fragment = document.createDocumentFragment()

    newTabPage.reminders.forEach(function (reminder, index) {
      const item = document.createElement('li')
      item.className = 'ntp-list-item'

      const content = document.createElement('span')
      content.textContent = reminder.text

      const removeButton = document.createElement('button')
      removeButton.className = 'ntp-inline-delete i carbon:close'
      removeButton.setAttribute('aria-label', 'Supprimer le rappel')
      removeButton.addEventListener('click', function () {
        newTabPage.reminders.splice(index, 1)
        newTabPage.saveReminders()
        newTabPage.renderReminders()
      })

      item.appendChild(content)
      item.appendChild(removeButton)
      fragment.appendChild(item)
    })

    newTabPage.reminderList.appendChild(fragment)
  },
  createPageListItem: function (item) {
    const listItem = document.createElement('li')
    listItem.className = 'ntp-list-item'

    const link = document.createElement('button')
    link.className = 'ntp-link-button'
    link.textContent = item.title || item.url
    link.title = item.url

    const meta = document.createElement('span')
    meta.className = 'ntp-item-meta'
    meta.textContent = newTabPage.getHistoryContext(item)

    link.addEventListener('click', function () {
      searchbar.events.emit('url-selected', { url: item.url, background: false })
    })

    listItem.appendChild(link)
    if (item.lastVisit) {
      listItem.appendChild(meta)
    }
    return listItem
  },

  getHistoryItemType: function (item) {
    const sourceURL = (item && item.url) || ''
    const title = ((item && item.title) || '').toLowerCase()
    const lowerURL = sourceURL.toLowerCase()

    if (lowerURL.endsWith('.pdf') || lowerURL.includes('/pdf') || title.includes('pdf')) {
      return 'pdf'
    }

    if (lowerURL.startsWith('file://')) {
      return 'fichier'
    }

    return 'web'
  },
  getHistoryContext: function (item) {
    const visitedAt = item && item.lastVisit ? new Date(item.lastVisit) : null
    const type = newTabPage.getHistoryItemType(item)
    const dateLabel = visitedAt ? visitedAt.toLocaleDateString('fr-FR') : 'date inconnue'
    return `${type} • ${dateLabel}`
  },
  getBooleanPreference: function (storageKey, defaultValue) {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) {
      return defaultValue
    }
    return raw !== 'false'
  },
  sanitizeDisplayPreference: function (storageKey, allowedValues, defaultValue) {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return defaultValue
    }

    if (allowedValues.includes(raw)) {
      return raw
    }

    localStorage.setItem(storageKey, defaultValue)
    return defaultValue
  },
  resetPersonalizationPreferences: function () {
    localStorage.setItem(DENSITY_STORAGE_KEY, 'comfortable')
    localStorage.setItem(GLASS_STORAGE_KEY, 'balanced')
    localStorage.setItem(SHOW_WIDGETS_STORAGE_KEY, 'true')
    localStorage.setItem(SHOW_FAVORITES_STORAGE_KEY, 'true')
    localStorage.setItem(SHOW_HISTORY_STORAGE_KEY, 'true')
    newTabPage.applyDisplayPreferences()
    newTabPage.renderHistoryAndFavorites()
  },
  applyDisplayPreferences: function () {
    const density = newTabPage.sanitizeDisplayPreference(DENSITY_STORAGE_KEY, ['comfortable', 'compact'], 'comfortable')
    const glass = newTabPage.sanitizeDisplayPreference(GLASS_STORAGE_KEY, ['balanced', 'soft', 'strong'], 'balanced')
    const showWidgets = newTabPage.getBooleanPreference(SHOW_WIDGETS_STORAGE_KEY, true)
    const showFavorites = newTabPage.getBooleanPreference(SHOW_FAVORITES_STORAGE_KEY, true)
    const showHistory = newTabPage.getBooleanPreference(SHOW_HISTORY_STORAGE_KEY, true)

    document.body.classList.toggle('ntp-density-compact', density === 'compact')
    document.body.classList.toggle('ntp-glass-soft', glass === 'soft')
    document.body.classList.toggle('ntp-glass-strong', glass === 'strong')

    if (newTabPage.widgetsPanel) {
      newTabPage.widgetsPanel.hidden = !showWidgets
    }
    if (newTabPage.favoritesPanel) {
      newTabPage.favoritesPanel.hidden = !showFavorites
    }
    if (newTabPage.historyPanel) {
      newTabPage.historyPanel.hidden = !showHistory
    }

    if (newTabPage.densitySelector) {
      newTabPage.densitySelector.value = density
    }
    if (newTabPage.glassSelector) {
      newTabPage.glassSelector.value = glass
    }
    if (newTabPage.toggleWidgets) {
      newTabPage.toggleWidgets.checked = showWidgets
    }
    if (newTabPage.toggleFavorites) {
      newTabPage.toggleFavorites.checked = showFavorites
    }
    if (newTabPage.toggleHistory) {
      newTabPage.toggleHistory.checked = showHistory
    }
  },
  bindPersonalizationControls: function () {
    if (newTabPage.densitySelector) {
      newTabPage.densitySelector.addEventListener('change', function () {
        localStorage.setItem(DENSITY_STORAGE_KEY, newTabPage.densitySelector.value === 'compact' ? 'compact' : 'comfortable')
        newTabPage.applyDisplayPreferences()
      })
    }

    if (newTabPage.glassSelector) {
      newTabPage.glassSelector.addEventListener('change', function () {
        const value = ['balanced', 'soft', 'strong'].includes(newTabPage.glassSelector.value) ? newTabPage.glassSelector.value : 'balanced'
        localStorage.setItem(GLASS_STORAGE_KEY, value)
        newTabPage.applyDisplayPreferences()
      })
    }

    if (newTabPage.toggleWidgets) {
      newTabPage.toggleWidgets.addEventListener('change', function () {
        localStorage.setItem(SHOW_WIDGETS_STORAGE_KEY, String(newTabPage.toggleWidgets.checked))
        newTabPage.applyDisplayPreferences()
      })
    }

    if (newTabPage.toggleFavorites) {
      newTabPage.toggleFavorites.addEventListener('change', function () {
        localStorage.setItem(SHOW_FAVORITES_STORAGE_KEY, String(newTabPage.toggleFavorites.checked))
        newTabPage.applyDisplayPreferences()
      })
    }

    if (newTabPage.toggleHistory) {
      newTabPage.toggleHistory.addEventListener('change', function () {
        localStorage.setItem(SHOW_HISTORY_STORAGE_KEY, String(newTabPage.toggleHistory.checked))
        newTabPage.applyDisplayPreferences()
      })
    }

    if (newTabPage.personalizationPanel) {
      newTabPage.personalizationPanel.addEventListener('click', function (event) {
        const actionButton = event.target.closest('[data-ntp-action]')
        if (!actionButton || !newTabPage.personalizationPanel.contains(actionButton)) {
          return
        }

        const action = actionButton.getAttribute('data-ntp-action')
        if (action === 'random-background') {
          newTabPage.applyRandomBackground()
          return
        }

        if (action === 'clear-background') {
          newTabPage.clearBackground()
          newTabPage.reloadBackground()
          return
        }

        if (action === 'reset-personalization') {
          newTabPage.resetPersonalizationPreferences()
        }
      })
    }
  },
  syncMaiSidebarA11y: function (isOpen) {
    if (!newTabPage.maiToggleButton) {
      return
    }

    newTabPage.maiToggleButton.setAttribute('aria-expanded', String(isOpen))
    newTabPage.maiToggleButton.setAttribute('aria-label', isOpen ? 'Fermer la barre mAI' : 'Ouvrir la barre mAI')
  },
  setMaiSidebarState: function (isOpen, options = {}) {
    if (!newTabPage.maiSidebar || !newTabPage.maiToggleButton || !document.body) {
      return
    }

    const shouldOpen = Boolean(isOpen)
    const shouldPersist = options.persist !== false

    newTabPage.isMaiSidebarOpen = shouldOpen
    newTabPage.maiSidebar.hidden = false
    newTabPage.maiSidebar.setAttribute('aria-hidden', String(!shouldOpen))
    document.body.classList.toggle('ntp-mai-open', shouldOpen)
    newTabPage.syncMaiSidebarA11y(shouldOpen)

    if (shouldPersist) {
      localStorage.setItem(MAI_SIDEBAR_STORAGE_KEY, String(shouldOpen))
    }
  },
  bindMaiSidebarControls: function () {
    if (!newTabPage.maiSidebar || !newTabPage.maiToggleButton) {
      return
    }

    const isEnabled = settings.get('maiSidebarEnabled')
    if (isEnabled === false) {
      newTabPage.maiToggleButton.hidden = true
      newTabPage.maiSidebar.hidden = true
      if (newTabPage.maiNewChatButton) {
        newTabPage.maiNewChatButton.hidden = true
      }
      return
    }

    newTabPage.maiToggleButton.hidden = false
    if (newTabPage.maiNewChatButton) {
      newTabPage.maiNewChatButton.hidden = false
    }

    const openOnStartup = settings.get('maiSidebarOpenStartup')
    if (openOnStartup === true) {
      newTabPage.setMaiSidebarState(true, { persist: false })
    } else {
      const storedState = newTabPage.getBooleanPreference(MAI_SIDEBAR_STORAGE_KEY, false)
      newTabPage.setMaiSidebarState(storedState, { persist: false })
    }

    newTabPage.maiToggleButton.addEventListener('click', function () {
      newTabPage.setMaiSidebarState(!newTabPage.isMaiSidebarOpen)
    })

    if (newTabPage.maiNewChatButton) {
      newTabPage.maiNewChatButton.addEventListener('click', function () {
        if (newTabPage.maiIframe) {
          // Force reload to start new chat
          const currentSrc = newTabPage.maiIframe.src
          newTabPage.maiIframe.src = 'about:blank'
          setTimeout(() => {
            newTabPage.maiIframe.src = currentSrc
          }, 10)
        }
        if (!newTabPage.isMaiSidebarOpen) {
          newTabPage.setMaiSidebarState(true)
        }
      })
    }

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !newTabPage.isMaiSidebarOpen) {
        return
      }

      newTabPage.setMaiSidebarState(false)
      newTabPage.maiToggleButton.focus()
    })

    // Handle position setting
    const position = settings.get('maiSidebarPosition') || 'right'
    if (position === 'left') {
      document.body.classList.add('mai-sidebar-left')
    }

    settings.listen('maiSidebarPosition', function (value) {
      if (value === 'left') {
        document.body.classList.add('mai-sidebar-left')
      } else {
        document.body.classList.remove('mai-sidebar-left')
      }
    })

    // Handle global visibility setting
    const globalSidebar = settings.get('maiSidebarGlobal') !== false
    if (!globalSidebar) {
      document.body.classList.add('mai-sidebar-restricted')
    }

    settings.listen('maiSidebarGlobal', function (value) {
      if (value === false) {
        document.body.classList.add('mai-sidebar-restricted')
      } else {
        document.body.classList.remove('mai-sidebar-restricted')
      }
    })
  },
  renderHistoryAndFavorites: async function () {
    if (!newTabPage.favoritesList || !newTabPage.historyList) {
      return
    }

    newTabPage.favoritesList.textContent = ''
    newTabPage.historyList.textContent = ''

    try {
      const showFavorites = settings.get('ntpShowFavorites') !== false && newTabPage.getBooleanPreference(SHOW_FAVORITES_STORAGE_KEY, true)
      const showHistory = settings.get('ntpShowHistory') !== false && newTabPage.getBooleanPreference(SHOW_HISTORY_STORAGE_KEY, true)

      if (newTabPage.favoritesPanel) {
        newTabPage.favoritesPanel.hidden = !showFavorites
      }
      if (newTabPage.historyPanel) {
        newTabPage.historyPanel.hidden = !showHistory
      }

      const [favorites, historyItems] = await Promise.all([
        showFavorites ? places.searchPlaces('', { limit: 8, searchBookmarks: true }) : Promise.resolve([]),
        showHistory ? places.searchPlaces('', { limit: 8 }) : Promise.resolve([])
      ])
      const historyWithoutBookmarks = historyItems.filter(item => !item.isBookmarked).slice(0, 8)

      const favoritesFragment = document.createDocumentFragment()
      const historyFragment = document.createDocumentFragment()

      if (favorites.length === 0) {
        const emptyFavorites = document.createElement('li')
        emptyFavorites.className = 'ntp-empty-state'
        emptyFavorites.textContent = 'Ajoutez vos sites préférés pour les retrouver ici.'
        favoritesFragment.appendChild(emptyFavorites)
      } else {
        favorites.forEach(item => {
          favoritesFragment.appendChild(newTabPage.createPageListItem(item))
        })
      }

      if (historyWithoutBookmarks.length === 0) {
        const emptyHistory = document.createElement('li')
        emptyHistory.className = 'ntp-empty-state'
        emptyHistory.textContent = 'Votre historique récent apparaîtra ici.'
        historyFragment.appendChild(emptyHistory)
      } else {
        historyWithoutBookmarks.forEach(item => {
          historyFragment.appendChild(newTabPage.createPageListItem(item))
        })
      }

      newTabPage.favoritesList.appendChild(favoritesFragment)
      newTabPage.historyList.appendChild(historyFragment)
    } catch (e) {
      const errorState = document.createElement('li')
      errorState.className = 'ntp-empty-state'
      errorState.textContent = 'Impossible de charger les éléments.'
      newTabPage.favoritesList.appendChild(errorState.cloneNode(true))
      newTabPage.historyList.appendChild(errorState)
    }
  },
  scheduleHistoryRefresh: function () {
    clearTimeout(newTabPage.historyRefreshTimer)
    newTabPage.historyRefreshTimer = setTimeout(function () {
      newTabPage.renderHistoryAndFavorites()
    }, 180)
  },
  updateLiveHeader: function () {
    if (!newTabPage.dateOutput || !newTabPage.timeOutput) {
      return
    }

    var now = new Date()
    newTabPage.dateOutput.textContent = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    })
    newTabPage.timeOutput.textContent = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    })

    if (newTabPage.subtitle) {
      newTabPage.subtitle.textContent = 'Accueil • ' + now.toLocaleDateString('fr-FR')
    }
  },
  applyRandomBackground: function () {
    if (!newTabPage.background || !newTabPage.deleteBackground || !newTabPage.backgroundOverlay) {
      return
    }

    const current = localStorage.getItem(RANDOM_BG_STORAGE_KEY)
    let next = curatedBackgrounds[Math.floor(Math.random() * curatedBackgrounds.length)]

    if (curatedBackgrounds.length > 1) {
      while (next === current) {
        next = curatedBackgrounds[Math.floor(Math.random() * curatedBackgrounds.length)]
      }
    }

    localStorage.setItem(RANDOM_BG_STORAGE_KEY, next)
    newTabPage.setBackgroundSource(next)
  },
  clearBackground: function () {
    localStorage.removeItem(RANDOM_BG_STORAGE_KEY)
  },
  reloadBackground: function () {
    if (!newTabPage.background || !newTabPage.deleteBackground || !newTabPage.backgroundOverlay) {
      return
    }

    const randomBg = localStorage.getItem(RANDOM_BG_STORAGE_KEY)
    if (randomBg && settings.get('ntpRandomBackgroundEnabled') !== false) {
      newTabPage.setBackgroundSource(randomBg)
      return
    }

    fs.readFile(newTabPage.imagePath, function (err, data) {
      if (newTabPage.blobInstance) {
        URL.revokeObjectURL(newTabPage.blobInstance)
        newTabPage.blobInstance = null
      }

      if (err) {
        newTabPage.setBackgroundVisualState(false)
        return
      }

      const blob = new Blob([data], { type: 'application/octet-binary' })
      const url = URL.createObjectURL(blob)
      newTabPage.blobInstance = url
      newTabPage.setBackgroundSource(url)
    })
  },
  bindQuickActions: function () {
    newTabPage.actionButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const action = button.getAttribute('data-ntp-action')
        const tabId = tabs.getSelected()

        if (action === 'open-search') {
          tabEditor.show(tabId)
          return
        }

        if (action === 'open-history') {
          tabEditor.show(tabId, '!history ')
          return
        }

        if (action === 'open-favorites') {
          tabEditor.show(tabId, '!bookmarks ')
          return
        }

        if (action === 'open-weather') {
          searchbar.events.emit('url-selected', { url: 'https://www.meteofrance.com/previsions-meteo-france', background: false })
          return
        }

        if (action === 'open-news') {
          searchbar.events.emit('url-selected', { url: 'https://news.google.com/?hl=fr&gl=FR&ceid=FR:fr', background: false })
          return
        }

        if (action === 'open-agenda') {
          searchbar.events.emit('url-selected', { url: 'https://calendar.google.com', background: false })
          return
        }

        if (action === 'open-notes') {
          document.body.dispatchEvent(new CustomEvent('productivityhub:open-notes'))
        }
      })
    })
  },
  bindSearch: function () {
    if (!newTabPage.searchForm || !newTabPage.searchInput) {
      return
    }

    newTabPage.searchForm.addEventListener('submit', function (e) {
      e.preventDefault()
      const query = newTabPage.searchInput.value.trim()

      if (!query) {
        return
      }

      const value = newTabPage.normalizeURL(query)
      searchbar.events.emit('url-selected', { url: value, background: false })
    })
  },
  initialize: function () {
    if (!document.body) {
      return
    }

    if (settings.get('ntpFixTitleOverlap') !== false) {
      document.body.classList.remove('has-overlay-ntp-title')
    }
    document.body.classList.toggle('ntp-reduced-motion', settings.get('liquidGlassAnimations') === false)
    newTabPage.applyTheme(newTabPage.getSelectedTheme())
    newTabPage.reloadBackground()
    newTabPage.loadReminders()
    localStorage.removeItem('msearch.ntp.shortcuts')
    newTabPage.renderReminders()
    newTabPage.applyDisplayPreferences()
    newTabPage.renderHistoryAndFavorites()
    newTabPage.bindQuickActions()
    newTabPage.bindSearch()
    newTabPage.bindPersonalizationControls()
    newTabPage.bindMaiSidebarControls()

    settings.listen('liquidGlassAnimations', function (value) {
      document.body.classList.toggle('ntp-reduced-motion', value === false)
    })

    if (newTabPage.picker) {
      newTabPage.picker.addEventListener('click', async function () {
        const filePath = await ipc.invoke('showOpenDialog', {
          filters: [
            { name: 'Image files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
          ]
        })

        if (!filePath) {
          return
        }

        localStorage.removeItem(RANDOM_BG_STORAGE_KEY)
        await fs.promises.copyFile(filePath[0], newTabPage.imagePath)
        newTabPage.reloadBackground()
      })
    }

    if (newTabPage.deleteBackground) {
      newTabPage.deleteBackground.addEventListener('click', async function () {
        try {
          await fs.promises.unlink(newTabPage.imagePath)
        } catch (e) {
          if (e.code !== 'ENOENT') {
            throw e
          }
        }
        newTabPage.clearBackground()
        newTabPage.reloadBackground()
      })
    }

    if (newTabPage.randomBackgroundButton) {
      newTabPage.randomBackgroundButton.hidden = settings.get('ntpRandomBackgroundEnabled') === false
      newTabPage.randomBackgroundButton.addEventListener('click', function () {
        newTabPage.applyRandomBackground()
      })
    }

    if (newTabPage.themeSelector) {
      newTabPage.themeSelector.addEventListener('change', function () {
        newTabPage.applyTheme(newTabPage.themeSelector.value)
      })
    }

    if (newTabPage.reminderForm) {
      newTabPage.reminderForm.addEventListener('submit', function (e) {
        e.preventDefault()
        const reminderText = newTabPage.reminderInput.value.trim()

        if (!reminderText) {
          return
        }

        newTabPage.reminders.unshift({
          id: Date.now(),
          text: reminderText
        })

        if (newTabPage.reminders.length > MAX_REMINDERS) {
          newTabPage.reminders = newTabPage.reminders.slice(0, MAX_REMINDERS)
        }

        newTabPage.saveReminders()
        newTabPage.renderReminders()
        newTabPage.reminderInput.value = ''
      })
    }

    searchbar.events.on('url-selected', function () {
      newTabPage.scheduleHistoryRefresh()
    })

    newTabPage.updateLiveHeader()
    clearInterval(newTabPage.clockTimer)
    newTabPage.clockTimer = setInterval(newTabPage.updateLiveHeader, 60000)

    statistics.registerGetter('ntpHasBackground', function () {
      return newTabPage.hasBackground
    })
  }
}

module.exports = newTabPage
