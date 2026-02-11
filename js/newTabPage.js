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
const MAX_REMINDERS = 12
const DEFAULT_MAX_SHORTCUTS = 8

const themes = {
  aurora: 'linear-gradient(120deg, rgba(49, 87, 255, 0.45), rgba(65, 230, 180, 0.25), rgba(203, 124, 255, 0.35))',
  ocean: 'linear-gradient(120deg, rgba(6, 80, 204, 0.5), rgba(44, 167, 210, 0.25), rgba(15, 42, 100, 0.45))',
  sunset: 'linear-gradient(120deg, rgba(232, 124, 32, 0.5), rgba(222, 80, 130, 0.35), rgba(103, 34, 167, 0.4))'
}

const curatedBackgrounds = [
  'https://picsum.photos/seed/msearch-bg-1/1920/1080',
  'https://picsum.photos/seed/msearch-bg-2/1920/1080',
  'https://picsum.photos/seed/msearch-bg-3/1920/1080',
  'https://picsum.photos/seed/msearch-bg-4/1920/1080',
  'https://picsum.photos/seed/msearch-bg-5/1920/1080',
  'https://picsum.photos/seed/msearch-bg-6/1920/1080',
  'https://picsum.photos/seed/msearch-bg-7/1920/1080',
  'https://picsum.photos/seed/msearch-bg-8/1920/1080',
  'https://picsum.photos/seed/msearch-bg-9/1920/1080',
  'https://picsum.photos/seed/msearch-bg-10/1920/1080',
  'https://picsum.photos/seed/msearch-bg-11/1920/1080',
  'https://picsum.photos/seed/msearch-bg-12/1920/1080',
  'https://picsum.photos/seed/msearch-bg-13/1920/1080',
  'https://picsum.photos/seed/msearch-bg-14/1920/1080',
  'https://picsum.photos/seed/msearch-bg-15/1920/1080',
  'https://picsum.photos/seed/msearch-bg-16/1920/1080',
  'https://picsum.photos/seed/msearch-bg-17/1920/1080',
  'https://picsum.photos/seed/msearch-bg-18/1920/1080',
  'https://picsum.photos/seed/msearch-bg-19/1920/1080',
  'https://picsum.photos/seed/msearch-bg-20/1920/1080',
  'https://picsum.photos/seed/msearch-bg-21/1920/1080',
  'https://picsum.photos/seed/msearch-bg-22/1920/1080',
  'https://picsum.photos/seed/msearch-bg-23/1920/1080',
  'https://picsum.photos/seed/msearch-bg-24/1920/1080'
]

const defaultShortcuts = [
  { title: 'GitHub', url: 'https://github.com' },
  { title: 'YouTube', url: 'https://youtube.com' },
  { title: 'Wikipedia', url: 'https://wikipedia.org' },
  { title: 'Météo', url: 'https://meteofrance.com' }
]

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
  headerMeta: document.getElementById('ntp-meta'),
  quickActionsBound: false,
  searchBound: false,
  shortcutsBound: false,
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  reminders: [],
  shortcuts: [],
  maxShortcuts: settings.get('ntpMaxShortcuts') || DEFAULT_MAX_SHORTCUTS,
  clockTimer: null,
  historyRefreshTimer: null,
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
  applyUISettings: function () {
    const showWidgets = settings.get('ntpShowWidgets') !== false
    const showClock = settings.get('ntpShowClock') !== false
    const compactLayout = settings.get('ntpCompactLayout') === true
    const glassStrength = settings.get('ntpGlassStrength') || 'balanced'

    if (newTabPage.widgetsPanel) {
      newTabPage.widgetsPanel.hidden = !showWidgets
    }
    if (newTabPage.headerMeta) {
      newTabPage.headerMeta.hidden = !showClock
    }

    document.body.classList.toggle('ntp-compact-layout', compactLayout)
    document.body.classList.remove('ntp-glass-soft', 'ntp-glass-balanced', 'ntp-glass-strong')
    if (['soft', 'balanced', 'strong'].indexOf(glassStrength) !== -1) {
      document.body.classList.add('ntp-glass-' + glassStrength)
    } else {
      document.body.classList.add('ntp-glass-balanced')
    }

    if (settings.get('ntpFixTitleOverlap') !== false) {
      document.body.classList.add('ntp-fix-title-overlap')
    } else {
      document.body.classList.remove('ntp-fix-title-overlap')
    }
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
      empty.textContent = 'Ajoutez un raccourci pour démarrer plus vite.'
      newTabPage.shortcutsList.appendChild(empty)
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
      openButton.addEventListener('click', function () {
        searchbar.events.emit('url-selected', { url: item.url, background: false })
      })

      const editButton = document.createElement('button')
      editButton.className = 'ntp-inline-icon i carbon:edit'
      editButton.setAttribute('aria-label', 'Modifier le raccourci')
      editButton.addEventListener('click', function () {
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
      })

      const deleteButton = document.createElement('button')
      deleteButton.className = 'ntp-inline-icon i carbon:trash-can'
      deleteButton.setAttribute('aria-label', 'Supprimer le raccourci')
      deleteButton.addEventListener('click', function () {
        newTabPage.shortcuts.splice(index, 1)
        newTabPage.saveShortcuts()
        newTabPage.renderShortcuts()
      })

      listItem.appendChild(openButton)
      listItem.appendChild(editButton)
      listItem.appendChild(deleteButton)
      fragment.appendChild(listItem)
    })

    newTabPage.shortcutsList.appendChild(fragment)
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
  renderHistoryAndFavorites: async function () {
    if (!newTabPage.favoritesList || !newTabPage.historyList) {
      return
    }

    newTabPage.favoritesList.textContent = ''
    newTabPage.historyList.textContent = ''

    try {
      const showFavorites = settings.get('ntpShowFavorites') !== false
      const showHistory = settings.get('ntpShowHistory') !== false
      const favoritesPanel = document.getElementById('ntp-favorites-panel')
      const historyPanel = document.getElementById('ntp-history-panel')

      if (favoritesPanel) {
        favoritesPanel.hidden = !showFavorites
      }
      if (historyPanel) {
        historyPanel.hidden = !showHistory
      }

      const favorites = showFavorites ? await places.searchPlaces('', { limit: 8, searchBookmarks: true }) : []
      const historyItems = showHistory ? await places.searchPlaces('', { limit: 8 }) : []
      const historyWithoutBookmarks = historyItems.filter(item => !item.isBookmarked).slice(0, 8)

      if (favorites.length === 0) {
        const emptyFavorites = document.createElement('li')
        emptyFavorites.className = 'ntp-empty-state'
        emptyFavorites.textContent = 'Ajoutez vos sites préférés pour les retrouver ici.'
        newTabPage.favoritesList.appendChild(emptyFavorites)
      } else {
        favorites.forEach(item => {
          newTabPage.favoritesList.appendChild(newTabPage.createPageListItem(item))
        })
      }

      if (historyWithoutBookmarks.length === 0) {
        const emptyHistory = document.createElement('li')
        emptyHistory.className = 'ntp-empty-state'
        emptyHistory.textContent = 'Votre historique récent apparaîtra ici.'
        newTabPage.historyList.appendChild(emptyHistory)
      } else {
        historyWithoutBookmarks.forEach(item => {
          newTabPage.historyList.appendChild(newTabPage.createPageListItem(item))
        })
      }
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
      newTabPage.subtitle.textContent = 'Accueil intelligent Liquid Glass • ' + now.toLocaleDateString('fr-FR')
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
    newTabPage.background.src = next
    newTabPage.background.hidden = false
    newTabPage.hasBackground = true
    document.body.classList.add('ntp-has-background')
    newTabPage.deleteBackground.hidden = false
    newTabPage.backgroundOverlay.style.backgroundImage = 'linear-gradient(120deg, rgba(11, 14, 23, 0.35), rgba(17, 24, 39, 0.58))'
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
      newTabPage.background.src = randomBg
      newTabPage.background.hidden = false
      newTabPage.hasBackground = true
      document.body.classList.add('ntp-has-background')
      newTabPage.deleteBackground.hidden = false
      newTabPage.backgroundOverlay.style.backgroundImage = 'linear-gradient(120deg, rgba(11, 14, 23, 0.35), rgba(17, 24, 39, 0.58))'
      return
    }

    fs.readFile(newTabPage.imagePath, function (err, data) {
      if (newTabPage.blobInstance) {
        URL.revokeObjectURL(newTabPage.blobInstance)
        newTabPage.blobInstance = null
      }

      if (err) {
        newTabPage.background.hidden = true
        newTabPage.hasBackground = false
        document.body.classList.remove('ntp-has-background')
        newTabPage.deleteBackground.hidden = true
        newTabPage.backgroundOverlay.style.backgroundImage = themes[newTabPage.getSelectedTheme()]
        return
      }

      const blob = new Blob([data], { type: 'application/octet-binary' })
      const url = URL.createObjectURL(blob)
      newTabPage.blobInstance = url
      newTabPage.background.src = url

      newTabPage.background.hidden = false
      newTabPage.hasBackground = true
      document.body.classList.add('ntp-has-background')
      newTabPage.deleteBackground.hidden = false
      newTabPage.backgroundOverlay.style.backgroundImage = 'linear-gradient(120deg, rgba(11, 14, 23, 0.45), rgba(17, 24, 39, 0.65))'
    })
  },
  bindQuickActions: function () {
    if (newTabPage.quickActionsBound) {
      return
    }
    newTabPage.quickActionsBound = true

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
    if (newTabPage.searchBound || !newTabPage.searchForm || !newTabPage.searchInput) {
      return
    }

    newTabPage.searchBound = true

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
    if (newTabPage.shortcutsBound || !newTabPage.shortcutAddButton) {
      return
    }

    newTabPage.shortcutsBound = true

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

    newTabPage.maxShortcuts = settings.get('ntpMaxShortcuts') || DEFAULT_MAX_SHORTCUTS
    document.body.classList.toggle('ntp-reduced-motion', settings.get('liquidGlassAnimations') === false)
    newTabPage.applyUISettings()
    newTabPage.applyTheme(newTabPage.getSelectedTheme())
    newTabPage.reloadBackground()
    newTabPage.loadReminders()
    newTabPage.loadShortcuts()
    newTabPage.renderReminders()
    newTabPage.renderShortcuts()
    newTabPage.renderHistoryAndFavorites()
    newTabPage.bindQuickActions()
    newTabPage.bindSearch()
    newTabPage.bindShortcutControls()

    settings.listen('liquidGlassAnimations', function (value) {
      document.body.classList.toggle('ntp-reduced-motion', value === false)
    })

    ;['ntpShowWidgets', 'ntpShowClock', 'ntpCompactLayout', 'ntpGlassStrength', 'ntpFixTitleOverlap'].forEach(function (settingKey) {
      settings.listen(settingKey, function () {
        newTabPage.applyUISettings()
      })
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
