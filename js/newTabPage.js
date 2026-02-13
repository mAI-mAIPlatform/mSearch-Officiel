const fs = require('fs')
const path = require('path')
const statistics = require('js/statistics.js')
const places = require('places/places.js')
const searchbar = require('searchbar/searchbar.js')
const tabEditor = require('navbar/tabEditor.js')
const settings = require('util/settings/settings.js')

const REMINDER_STORAGE_KEY = 'msearch.ntp.reminders'
const THEME_STORAGE_KEY = 'msearch.ntp.theme'
const SHORTCUTS_STORAGE_KEY = 'msearch.ntp.shortcuts'
const RANDOM_BG_STORAGE_KEY = 'msearch.ntp.randomBackground'
const DENSITY_STORAGE_KEY = 'msearch.ntp.density'
const GLASS_STORAGE_KEY = 'msearch.ntp.glass'
const SHOW_WIDGETS_STORAGE_KEY = 'msearch.ntp.showWidgets'
const SHOW_FAVORITES_STORAGE_KEY = 'msearch.ntp.showFavorites'
const SHOW_HISTORY_STORAGE_KEY = 'msearch.ntp.showHistory'
const MAX_REMINDERS = 12
const DEFAULT_MAX_SHORTCUTS = 5
const MAX_SHORTCUTS_LIMIT = 5

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
  'bright-horizon-05'
]

const curatedBackgrounds = baseBackgrounds.concat(brightBackgroundSeeds.map(function (seed) {
  return `https://picsum.photos/seed/msearch-${seed}/1920/1080`
}))

// Démarrage volontairement vide pour inviter l'utilisateur à personnaliser ses raccourcis.
const defaultShortcuts = []

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
  shortcutsList: document.getElementById('ntp-shortcuts-list'),
  shortcutAddButton: document.getElementById('ntp-shortcut-add'),
  actionButtons: document.querySelectorAll('[data-ntp-action]'),
  widgetsPanel: document.getElementById('ntp-widgets-panel'),
  favoritesPanel: document.getElementById('ntp-favorites-panel'),
  historyPanel: document.getElementById('ntp-history-panel'),
  personalizationPanel: document.getElementById('ntp-personalization-panel'),
  densitySelector: document.getElementById('ntp-density-selector'),
  glassSelector: document.getElementById('ntp-glass-selector'),
  toggleWidgets: document.getElementById('ntp-toggle-widgets'),
  toggleFavorites: document.getElementById('ntp-toggle-favorites'),
  toggleHistory: document.getElementById('ntp-toggle-history'),
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  reminders: [],
  shortcuts: [],
  maxShortcuts: Math.min(Math.floor(Number(settings.get('ntpMaxShortcuts')) || DEFAULT_MAX_SHORTCUTS), MAX_SHORTCUTS_LIMIT),
  clockTimer: null,
  historyRefreshTimer: null,
  shortcutsEventsBound: false,
  getShortcutLimit: function () {
    const rawLimit = Number(settings.get('ntpMaxShortcuts'))
    if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
      return DEFAULT_MAX_SHORTCUTS
    }

    return Math.min(Math.floor(rawLimit), MAX_SHORTCUTS_LIMIT)
  },
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
  loadShortcuts: function () {
    try {
      const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : defaultShortcuts
      if (Array.isArray(parsed)) {
        newTabPage.shortcuts = parsed
          .filter(item => item && typeof item.title === 'string' && typeof item.url === 'string')
          .slice(0, newTabPage.maxShortcuts)
      } else {
        newTabPage.shortcuts = defaultShortcuts.slice()
      }
    } catch (e) {
      newTabPage.shortcuts = defaultShortcuts.slice()
    }
  },
  saveShortcuts: function () {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(newTabPage.shortcuts.slice(0, newTabPage.maxShortcuts)))
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
  renderShortcuts: function () {
    if (!newTabPage.shortcutsList) {
      return
    }

    newTabPage.shortcutsList.textContent = ''

    if (newTabPage.shortcuts.length === 0) {
      const empty = document.createElement('li')
      empty.className = 'ntp-empty-state'
      empty.textContent = `Ajoutez vos raccourcis favoris (max ${newTabPage.maxShortcuts}).`
      newTabPage.shortcutsList.appendChild(empty)

      if (newTabPage.shortcutAddButton) {
        newTabPage.shortcutAddButton.disabled = false
        newTabPage.shortcutAddButton.title = `Créer un raccourci (0/${newTabPage.maxShortcuts}).`
      }

      return
    }

    const fragment = document.createDocumentFragment()

    newTabPage.shortcuts.forEach(function (item, index) {
      const listItem = document.createElement('li')
      listItem.className = 'ntp-shortcut-item'

      const openButton = document.createElement('button')
      openButton.className = 'ntp-shortcut-open'
      openButton.textContent = item.title
      openButton.title = item.url
      openButton.setAttribute('data-shortcut-index', String(index))
      openButton.setAttribute('data-shortcut-action', 'open')

      const editButton = document.createElement('button')
      editButton.className = 'ntp-inline-icon i carbon:edit'
      editButton.setAttribute('aria-label', 'Modifier le raccourci')
      editButton.setAttribute('data-shortcut-index', String(index))
      editButton.setAttribute('data-shortcut-action', 'edit')

      const deleteButton = document.createElement('button')
      deleteButton.className = 'ntp-inline-icon i carbon:trash-can'
      deleteButton.setAttribute('aria-label', 'Supprimer le raccourci')
      deleteButton.setAttribute('data-shortcut-index', String(index))
      deleteButton.setAttribute('data-shortcut-action', 'delete')

      listItem.appendChild(openButton)
      listItem.appendChild(editButton)
      listItem.appendChild(deleteButton)
      fragment.appendChild(listItem)
    })

    newTabPage.shortcutsList.appendChild(fragment)

    if (newTabPage.shortcutAddButton) {
      const limitReached = newTabPage.shortcuts.length >= newTabPage.maxShortcuts
      newTabPage.shortcutAddButton.disabled = limitReached
      newTabPage.shortcutAddButton.title = limitReached
        ? `Limite atteinte (${newTabPage.maxShortcuts} raccourcis max).`
        : `Créer un raccourci (${newTabPage.shortcuts.length}/${newTabPage.maxShortcuts}).`
    }
  },
  createPageListItem: function (item) {
    const listItem = document.createElement('li')
    listItem.className = 'ntp-list-item ntp-page-list-item'

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
  applyDisplayPreferences: function () {
    const density = localStorage.getItem(DENSITY_STORAGE_KEY) || 'comfortable'
    const glass = localStorage.getItem(GLASS_STORAGE_KEY) || 'balanced'
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
  handleShortcutListClick: function (event) {
    const actionTarget = event.target.closest('[data-shortcut-action]')
    if (!actionTarget || !newTabPage.shortcutsList || !newTabPage.shortcutsList.contains(actionTarget)) {
      return
    }

    const action = actionTarget.getAttribute('data-shortcut-action')
    const index = Number(actionTarget.getAttribute('data-shortcut-index'))
    const item = newTabPage.shortcuts[index]

    if (!item || Number.isNaN(index)) {
      return
    }

    if (action === 'open') {
      searchbar.events.emit('url-selected', { url: item.url, background: false })
      return
    }

    if (action === 'edit') {
      const title = window.prompt('Nom du raccourci :', item.title)
      if (title === null) {
        return
      }

      const url = window.prompt('URL du raccourci :', item.url)
      if (url === null) {
        return
      }

      const safeURL = newTabPage.normalizeURL(url)
      if (!safeURL) {
        return
      }

      newTabPage.shortcuts[index] = { title: title.trim() || safeURL, url: safeURL }
      newTabPage.saveShortcuts()
      newTabPage.renderShortcuts()
      return
    }

    if (action === 'delete') {
      newTabPage.shortcuts.splice(index, 1)
      newTabPage.saveShortcuts()
      newTabPage.renderShortcuts()
    }
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
  bindShortcutControls: function () {
    if (!newTabPage.shortcutAddButton || newTabPage.shortcutsEventsBound) {
      return
    }

    newTabPage.shortcutsEventsBound = true

    if (newTabPage.shortcutsList) {
      newTabPage.shortcutsList.addEventListener('click', newTabPage.handleShortcutListClick)
    }

    newTabPage.shortcutAddButton.addEventListener('click', function () {
      if (newTabPage.shortcuts.length >= newTabPage.maxShortcuts) {
        return
      }

      const title = window.prompt('Nom du raccourci :')
      if (!title) {
        return
      }
      const url = window.prompt('URL du raccourci :')
      const safeURL = newTabPage.normalizeURL(url)
      if (!safeURL) {
        return
      }

      newTabPage.shortcuts.push({ title: title.trim(), url: safeURL })
      newTabPage.saveShortcuts()
      newTabPage.renderShortcuts()
    })
  },
  initialize: function () {
    if (!document.body) {
      return
    }

    if (settings.get('ntpFixTitleOverlap') !== false) {
      document.body.classList.remove('has-overlay-ntp-title')
    }
    newTabPage.maxShortcuts = newTabPage.getShortcutLimit()
    document.body.classList.toggle('ntp-reduced-motion', settings.get('liquidGlassAnimations') === false)
    newTabPage.applyTheme(newTabPage.getSelectedTheme())
    newTabPage.reloadBackground()
    newTabPage.loadReminders()
    newTabPage.loadShortcuts()
    newTabPage.renderReminders()
    newTabPage.renderShortcuts()
    newTabPage.applyDisplayPreferences()
    newTabPage.renderHistoryAndFavorites()
    newTabPage.bindQuickActions()
    newTabPage.bindSearch()
    newTabPage.bindShortcutControls()
    newTabPage.bindPersonalizationControls()

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
