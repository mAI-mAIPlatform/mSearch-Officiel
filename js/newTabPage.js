const fs = require('fs')
const path = require('path')
const statistics = require('js/statistics.js')
const places = require('places/places.js')
const searchbar = require('searchbar/searchbar.js')
const tabEditor = require('navbar/tabEditor.js')
const settings = require('util/settings/settings.js')

const REMINDER_STORAGE_KEY = 'msearch.ntp.reminders'
const SHORTCUTS_STORAGE_KEY = 'msearch.ntp.shortcuts'
const THEME_STORAGE_KEY = 'msearch.ntp.theme'
const RANDOM_BG_STORAGE_KEY = 'msearch.ntp.randomBackground'
const MAI_SIDEBAR_STORAGE_KEY = 'msearch.ntp.maiSidebarOpen'
const WIDGETS_STORAGE_KEY = 'msearch.ntp.widgets'
const MAX_REMINDERS = 12
const MAX_WIDGETS = 24

const WIDGET_ICON_CHOICES = [
  'carbon:launch',
  'carbon:flash',
  'carbon:star',
  'carbon:bookmark',
  'carbon:calendar',
  'carbon:time',
  'carbon:timer',
  'carbon:notebook',
  'carbon:cloudy',
  'carbon:newspaper',
  'carbon:chart-line',
  'carbon:search',
  'carbon:home',
  'carbon:earth-filled'
]

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
  shortcutsList: document.getElementById('ntp-shortcuts-list'),
  shortcutsPanel: document.getElementById('ntp-shortcuts-panel'),
  addShortcutButton: document.getElementById('ntp-add-shortcut-button'),
  favoritesList: document.getElementById('ntp-favorites-list'),
  historyList: document.getElementById('ntp-history-list'),
  searchForm: document.getElementById('ntp-search-form'),
  searchInput: document.getElementById('ntp-search-input'),
  subtitle: document.getElementById('ntp-subtitle'),
  dateOutput: document.getElementById('ntp-date'),
  timeOutput: document.getElementById('ntp-time'),
  actionButtons: document.querySelectorAll('#ntp-quick-actions [data-ntp-action]'),
  widgetsPanel: document.getElementById('ntp-widgets-panel'),
  widgetGrid: document.getElementById('ntp-widget-grid'),
  addWidgetButton: document.getElementById('ntp-add-widget-button'),
  resetWidgetsButton: document.getElementById('ntp-reset-widgets-button'),
  widgetFilterInput: document.getElementById('ntp-widget-filter'),
  favoritesPanel: document.getElementById('ntp-favorites-panel'),
  historyPanel: document.getElementById('ntp-history-panel'),
  maiSidebar: document.getElementById('ntp-mai-sidebar'),
  maiToggleButton: document.getElementById('ntp-mai-toggle'),
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  reminders: [],
  shortcuts: [],
  widgets: [],
  clockTimer: null,
  widgetTimers: {},
  historyRefreshTimer: null,
  isMaiSidebarOpen: false,
  getWidgetGridColumns: function () {
    if (!newTabPage.widgetGrid) {
      return 1
    }

    var computed = window.getComputedStyle(newTabPage.widgetGrid)
    var templateColumns = computed.getPropertyValue('grid-template-columns').trim()

    if (!templateColumns || templateColumns === 'none') {
      return 1
    }

    return Math.max(1, templateColumns.split(' ').length)
  },
  moveWidget: function (fromIndex, toIndex) {
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= newTabPage.widgets.length || toIndex >= newTabPage.widgets.length || fromIndex === toIndex) {
      return
    }

    var moved = newTabPage.widgets[fromIndex]
    newTabPage.widgets[fromIndex] = newTabPage.widgets[toIndex]
    newTabPage.widgets[toIndex] = moved
    newTabPage.saveWidgets()
    newTabPage.renderWidgets()
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
      if (raw) {
        newTabPage.shortcuts = JSON.parse(raw)
      } else {
        newTabPage.shortcuts = [
          { title: 'Téléchargements', url: 'min://downloads' },
          { title: 'Paramètres', url: 'min://settings' },
          { title: 'Favoris', url: 'min://bookmarks' }
        ]
        newTabPage.saveShortcuts()
      }
    } catch (e) {
      newTabPage.shortcuts = []
    }
  },
  saveShortcuts: function () {
    localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(newTabPage.shortcuts))
  },
  renderShortcuts: function () {
    if (!newTabPage.shortcutsList) return

    newTabPage.shortcutsList.textContent = ''

    let max = settings.get('ntpMaxShortcuts')
    if (!max) max = 8
    // Ensure we handle the new 10/12 options if they come as strings
    max = parseInt(max, 10)

    const visibleShortcuts = newTabPage.shortcuts.slice(0, max)

    if (visibleShortcuts.length === 0) {
      const emptyState = document.createElement('li')
      emptyState.className = 'ntp-empty-state'
      emptyState.textContent = 'Aucun raccourci.'
      newTabPage.shortcutsList.appendChild(emptyState)
      return
    }

    const fragment = document.createDocumentFragment()

    visibleShortcuts.forEach(function (shortcut, index) {
      const item = document.createElement('li')
      item.className = 'ntp-list-item ntp-shortcut-item'

      const link = document.createElement('button')
      link.className = 'ntp-link-button'
      link.textContent = shortcut.title || shortcut.url
      link.title = shortcut.url
      link.addEventListener('click', function () {
        searchbar.events.emit('url-selected', { url: shortcut.url, background: false })
      })

      const removeButton = document.createElement('button')
      removeButton.className = 'ntp-inline-delete i carbon:close'
      removeButton.setAttribute('aria-label', 'Supprimer le raccourci')
      removeButton.addEventListener('click', function (e) {
        e.stopPropagation()
        newTabPage.shortcuts.splice(index, 1)
        newTabPage.saveShortcuts()
        newTabPage.renderShortcuts()
      })

      item.appendChild(link)
      item.appendChild(removeButton)
      fragment.appendChild(item)
    })

    newTabPage.shortcutsList.appendChild(fragment)
  },

  getDefaultWidgets: function () {
    return [
      { id: 'weather', action: 'open-weather', icon: 'carbon:cloudy', title: 'Météo', subtitle: 'Prévisions locales' },
      { id: 'news', action: 'open-news', icon: 'carbon:newspaper', title: 'Actualités', subtitle: 'Les titres du jour' },
      { id: 'agenda', action: 'open-agenda', icon: 'carbon:calendar', title: 'Agenda', subtitle: 'Voir le planning' },
      { id: 'notes', action: 'open-notes', icon: 'carbon:notebook', title: 'Notes', subtitle: 'Note flottante rapide' },
      { id: 'clock', action: 'show-clock', icon: 'carbon:time', title: 'Horloge', subtitle: 'Heure locale instantanée' },
      { id: 'timer', action: 'open-timer', icon: 'carbon:timer', title: 'Minuteur', subtitle: 'Lancer un compte à rebours' },
      { id: 'analytics', action: 'open-analysis', icon: 'carbon:chart-line', title: 'Analyses', subtitle: 'Tendances et statistiques' },
      { id: 'translate', action: 'open-translate', icon: 'carbon:translate', title: 'Traduction', subtitle: 'Traduire un texte ou une page' },
      { id: 'mail', action: 'open-mail', icon: 'carbon:email', title: 'Mail', subtitle: 'Boîte de réception rapide' },
      { id: 'maps', action: 'open-maps', icon: 'carbon:map', title: 'Cartes', subtitle: 'Trajets et adresses' }
    ]
  },
  sanitizeWidgetIcon: function (icon) {
    var safe = String(icon || '').trim()
    if (!safe) {
      return 'carbon:flash'
    }

    if (/^carbon:[a-z0-9-]+$/i.test(safe)) {
      return safe.toLowerCase()
    }

    return 'carbon:flash'
  },
  sanitizeWidget: function (item) {
    if (!item || typeof item !== 'object') {
      return null
    }

    var fallbackId = 'widget-' + Date.now() + '-' + Math.floor(Math.random() * 10000)
    var action = item.action || 'open-url'
    var title = (item.title || '').trim()
    if (!title) {
      title = action === 'open-url' ? 'Widget perso' : 'Widget'
    }

    var normalized = {
      id: item.id || fallbackId,
      action: action,
      icon: newTabPage.sanitizeWidgetIcon(item.icon),
      title: title,
      subtitle: (item.subtitle || '').trim()
    }

    if (action === 'open-url') {
      normalized.url = newTabPage.normalizeURL(item.url || '')
      if (!normalized.url) {
        return null
      }
      if (!normalized.subtitle) {
        normalized.subtitle = normalized.url
      }
    }

    return normalized
  },
  loadWidgets: function () {
    try {
      var parsed = JSON.parse(localStorage.getItem(WIDGETS_STORAGE_KEY) || '[]')
      var defaults = newTabPage.getDefaultWidgets().map(function (item) {
        return newTabPage.sanitizeWidget(item)
      }).filter(Boolean)

      if (!Array.isArray(parsed) || parsed.length === 0) {
        newTabPage.widgets = defaults
        return
      }

      var defaultMap = {}
      defaults.forEach(function (item) {
        defaultMap[item.id] = item
      })

      newTabPage.widgets = parsed.map(function (item) {
        if (!item) {
          return null
        }

        if (item.id && defaultMap[item.id] && !item.url) {
          return defaultMap[item.id]
        }

        return newTabPage.sanitizeWidget(item)
      }).filter(Boolean)

      if (newTabPage.widgets.length === 0) {
        newTabPage.widgets = defaults
      }
    } catch (e) {
      newTabPage.widgets = newTabPage.getDefaultWidgets()
    }
  },
  saveWidgets: function () {
    localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(newTabPage.widgets.map(function (item) {
      return {
        id: item.id,
        action: item.action,
        icon: item.icon,
        title: item.title,
        subtitle: item.subtitle,
        url: item.url
      }
    })))
  },
  promptAddWidget: function () {
    var result = ipc.sendSync('prompt', {
      text: 'Ajouter un widget rapide',
      values: [
        { placeholder: 'Titre du widget', id: 'title', type: 'text' },
        { placeholder: 'URL de destination (https://...)', id: 'url', type: 'text' },
        { placeholder: 'Icône (ex: carbon:launch). Choix: ' + WIDGET_ICON_CHOICES.join(', '), id: 'icon', type: 'text' }
      ],
      ok: 'Créer',
      cancel: 'Annuler',
      height: 300
    })

    if (!result || !result.title || !result.url) {
      return
    }

    var widget = newTabPage.sanitizeWidget({
      id: 'custom-' + Date.now(),
      action: 'open-url',
      icon: result.icon || 'carbon:launch',
      title: result.title,
      subtitle: 'Widget personnalisé',
      url: result.url
    })

    if (!widget) {
      return
    }

    if (newTabPage.widgets.length >= MAX_WIDGETS) {
      alert('Limite atteinte : ' + MAX_WIDGETS + ' widgets maximum.')
      return
    }

    newTabPage.widgets.push(widget)
    newTabPage.saveWidgets()
    newTabPage.renderWidgets()
  },
  promptEditWidgetURL: function (index) {
    var widget = newTabPage.widgets[index]
    if (!widget || widget.action !== 'open-url') {
      return
    }

    var nextURL = window.prompt('Modifier l’URL du widget', widget.url || '')
    if (nextURL === null) {
      return
    }

    widget.url = newTabPage.normalizeURL(nextURL)
    if (!widget.url) {
      return
    }

    if (!widget.subtitle || widget.subtitle === widget.url) {
      widget.subtitle = widget.url
    }

    newTabPage.saveWidgets()
    newTabPage.renderWidgets()
  },
  getFilteredWidgets: function () {
    var query = ''
    if (newTabPage.widgetFilterInput) {
      query = newTabPage.widgetFilterInput.value.trim().toLowerCase()
    }

    if (!query) {
      return newTabPage.widgets
    }

    return newTabPage.widgets.filter(function (widget) {
      var haystack = [widget.title, widget.subtitle, widget.action, widget.url].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  },
  clearWidgetTimers: function () {
    Object.keys(newTabPage.widgetTimers).forEach(function (key) {
      clearTimeout(newTabPage.widgetTimers[key])
    })
    newTabPage.widgetTimers = {}
  },
  renderWidgets: function () {
    if (!newTabPage.widgetGrid) {
      return
    }

    newTabPage.widgetGrid.textContent = ''

    var filteredWidgets = newTabPage.getFilteredWidgets()

    if (filteredWidgets.length === 0) {
      var emptyState = document.createElement('p')
      emptyState.className = 'ntp-empty-state'
      emptyState.textContent = newTabPage.widgets.length === 0
        ? 'Aucun widget. Utilisez Ajouter ou Réinitialiser.'
        : 'Aucun widget ne correspond au filtre.'
      newTabPage.widgetGrid.appendChild(emptyState)
      return
    }

    var fragment = document.createDocumentFragment()
    var columnCount = newTabPage.getWidgetGridColumns()

    filteredWidgets.forEach(function (widget) {
      var index = newTabPage.widgets.findIndex(function (item) {
        return item.id === widget.id
      })

      if (index < 0) {
        return
      }

      var button = document.createElement('button')
      button.type = 'button'
      button.className = 'ntp-widget-card'
      button.setAttribute('data-ntp-action', widget.action)
      if (widget.url) {
        button.setAttribute('data-widget-url', widget.url)
      }

      var icon = document.createElement('i')
      icon.className = 'i ' + newTabPage.sanitizeWidgetIcon(widget.icon)

      var title = document.createElement('strong')
      title.textContent = widget.title

      var subtitle = document.createElement('span')
      subtitle.textContent = widget.subtitle

      var controls = document.createElement('div')
      controls.className = 'ntp-widget-controls'

      var moveLeft = document.createElement('button')
      moveLeft.type = 'button'
      moveLeft.className = 'ntp-widget-control i carbon:arrow-left'
      moveLeft.disabled = index === 0
      moveLeft.setAttribute('aria-label', 'Déplacer le widget vers la gauche')
      moveLeft.addEventListener('click', function (event) {
        event.stopPropagation()
        newTabPage.moveWidget(index, index - 1)
      })

      var moveRight = document.createElement('button')
      moveRight.type = 'button'
      moveRight.className = 'ntp-widget-control i carbon:arrow-right'
      moveRight.disabled = index === newTabPage.widgets.length - 1
      moveRight.setAttribute('aria-label', 'Déplacer le widget vers la droite')
      moveRight.addEventListener('click', function (event) {
        event.stopPropagation()
        newTabPage.moveWidget(index, index + 1)
      })

      var moveUp = document.createElement('button')
      moveUp.type = 'button'
      moveUp.className = 'ntp-widget-control i carbon:arrow-up'
      moveUp.disabled = index < columnCount
      moveUp.setAttribute('aria-label', 'Déplacer le widget vers le haut')
      moveUp.addEventListener('click', function (event) {
        event.stopPropagation()
        newTabPage.moveWidget(index, index - columnCount)
      })

      var moveDown = document.createElement('button')
      moveDown.type = 'button'
      moveDown.className = 'ntp-widget-control i carbon:arrow-down'
      moveDown.disabled = index + columnCount >= newTabPage.widgets.length
      moveDown.setAttribute('aria-label', 'Déplacer le widget vers le bas')
      moveDown.addEventListener('click', function (event) {
        event.stopPropagation()
        newTabPage.moveWidget(index, index + columnCount)
      })

      if (widget.action === 'open-url') {
        var edit = document.createElement('button')
        edit.type = 'button'
        edit.className = 'ntp-widget-control i carbon:edit'
        edit.setAttribute('aria-label', 'Modifier l’URL du widget')
        edit.addEventListener('click', function (event) {
          event.stopPropagation()
          newTabPage.promptEditWidgetURL(index)
        })
        controls.appendChild(edit)
      }

      var remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'ntp-widget-control i carbon:close'
      remove.setAttribute('aria-label', 'Supprimer le widget')
      remove.addEventListener('click', function (event) {
        event.stopPropagation()
        newTabPage.widgets.splice(index, 1)
        newTabPage.saveWidgets()
        newTabPage.renderWidgets()
      })

      controls.appendChild(moveLeft)
      controls.appendChild(moveRight)
      controls.appendChild(moveUp)
      controls.appendChild(moveDown)
      controls.appendChild(remove)

      button.appendChild(icon)
      button.appendChild(title)
      button.appendChild(subtitle)
      button.appendChild(controls)
      fragment.appendChild(button)
    })

    newTabPage.widgetGrid.appendChild(fragment)
    newTabPage.bindWidgetActions()
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

    // Si la sidebar est désactivée globalement, on force la fermeture et le masquage
    const enabledValue = settings.get('maiSidebarEnabled')
    const isEnabled = enabledValue !== false && enabledValue !== 'false'
    if (!isEnabled) {
      newTabPage.isMaiSidebarOpen = false
      newTabPage.maiSidebar.hidden = true
      newTabPage.maiSidebar.setAttribute('aria-hidden', 'true')
      document.body.classList.remove('ntp-mai-open')
      newTabPage.syncMaiSidebarA11y(false)
      if (options.persist !== false) {
        localStorage.setItem(MAI_SIDEBAR_STORAGE_KEY, 'false')
      }
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

    // Initialisation : gestion de l'état activé/désactivé et ouverture au démarrage
    const enabledValue = settings.get('maiSidebarEnabled')
    const isEnabled = enabledValue !== false && enabledValue !== 'false'
    newTabPage.maiToggleButton.hidden = !isEnabled

    if (!isEnabled) {
      newTabPage.setMaiSidebarState(false)
    } else {
      const openOnStartup = settings.get('maiSidebarOpenStartup')
      if (openOnStartup === true) {
        newTabPage.setMaiSidebarState(true, { persist: false })
      } else {
        const storedState = newTabPage.getBooleanPreference(MAI_SIDEBAR_STORAGE_KEY, false)
        newTabPage.setMaiSidebarState(storedState, { persist: false })
      }
    }

    settings.listen('maiSidebarEnabled', function (value) {
      var nextEnabled = value !== false && value !== 'false'
      newTabPage.maiToggleButton.hidden = !nextEnabled
      if (!nextEnabled) {
        newTabPage.setMaiSidebarState(false)
      } else {
        newTabPage.setMaiSidebarState(false, { persist: false })
        newTabPage.maiSidebar.hidden = false
      }
    })


    newTabPage.maiToggleButton.addEventListener('click', function () {
      newTabPage.setMaiSidebarState(!newTabPage.isMaiSidebarOpen)
    })

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !newTabPage.isMaiSidebarOpen) {
        return
      }

      newTabPage.setMaiSidebarState(false)
      if (newTabPage.maiToggleButton) {
        newTabPage.maiToggleButton.focus()
      }
    })

    // Handle position setting
    const applyMaiSidebarPosition = function (value) {
      // Normalize legacy/invalid values to avoid stale class state.
      const normalized = value === 'left' ? 'left' : 'right'
      document.body.classList.toggle('mai-sidebar-left', normalized === 'left')
    }

    applyMaiSidebarPosition(settings.get('maiSidebarPosition'))

    settings.listen('maiSidebarPosition', function (value) {
      applyMaiSidebarPosition(value)
    })

    // Handle global visibility setting
    const applyGlobalSidebarVisibility = function (value) {
      document.body.classList.toggle('mai-sidebar-restricted', value === false)
    }

    applyGlobalSidebarVisibility(settings.get('maiSidebarGlobal'))

    settings.listen('maiSidebarGlobal', function (value) {
      applyGlobalSidebarVisibility(value)
    })
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
        emptyFavorites.textContent = 'Aucun favoris n\'est disponible pour le moment.'
        favoritesFragment.appendChild(emptyFavorites)
      } else {
        favorites.forEach(item => {
          favoritesFragment.appendChild(newTabPage.createPageListItem(item))
        })
      }

      if (historyWithoutBookmarks.length === 0) {
        const emptyHistory = document.createElement('li')
        emptyHistory.className = 'ntp-empty-state'
        emptyHistory.textContent = 'Aucun historique n\'est disponible pour le moment.'
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
  handleNtpAction: function (action, targetURL) {
    const tabId = tabs.getSelected()

    if (action === 'open-search') {
      tabEditor.show(tabId)
      return
    }

    if (action === 'open-history' || action === 'open-history-page') {
      searchbar.events.emit('url-selected', { url: 'min://app/pages/history/index.html', background: false })
      return
    }

    if (action === 'open-favorites' || action === 'open-favorites-page') {
      searchbar.events.emit('url-selected', { url: 'min://app/pages/bookmarks/index.html', background: false })
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
      return
    }

    if (action === 'show-clock') {
      alert('Heure locale : ' + new Date().toLocaleTimeString('fr-FR'))
      return
    }

    if (action === 'open-timer') {
      var minutes = parseInt(window.prompt('Durée du minuteur (en minutes)', '15'), 10)
      if (!Number.isInteger(minutes) || minutes <= 0) {
        return
      }

      var timerKey = 'timer-' + Date.now()
      newTabPage.widgetTimers[timerKey] = setTimeout(function () {
        delete newTabPage.widgetTimers[timerKey]
        alert('Minuteur terminé (' + minutes + ' min).')
      }, minutes * 60 * 1000)
      return
    }

    if (action === 'open-translate') {
      searchbar.events.emit('url-selected', { url: 'https://translate.google.com/?hl=fr', background: false })
      return
    }

    if (action === 'open-mail') {
      searchbar.events.emit('url-selected', { url: 'https://mail.google.com', background: false })
      return
    }

    if (action === 'open-maps') {
      searchbar.events.emit('url-selected', { url: 'https://maps.google.com', background: false })
      return
    }

    if (action === 'open-analysis') {
      searchbar.events.emit('url-selected', { url: 'min://app/pages/settings/index.html#search-engine-settings-container', background: false })
      return
    }

    if (action === 'open-url' && targetURL) {
      searchbar.events.emit('url-selected', { url: targetURL, background: false })
    }
  },
  bindWidgetActions: function () {
    if (!newTabPage.widgetGrid) {
      return
    }

    var buttons = newTabPage.widgetGrid.querySelectorAll('[data-ntp-action]')
    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-ntp-action')
        var targetURL = button.getAttribute('data-widget-url')
        newTabPage.handleNtpAction(action, targetURL)
      })
    })
  },
  bindQuickActions: function () {
    newTabPage.actionButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const action = button.getAttribute('data-ntp-action')
        newTabPage.handleNtpAction(action)
      })
    })

    // Les boutons "Voir tout" des panneaux Favoris / Historique ne sont pas
    // dans #ntp-quick-actions : on les branche explicitement ici.
    const panelActionButtons = document.querySelectorAll('#ntp-grid .ntp-panel [data-ntp-action]')
    panelActionButtons.forEach((button) => {
      button.addEventListener('click', function () {
        const action = button.getAttribute('data-ntp-action')
        newTabPage.handleNtpAction(action)
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
    newTabPage.loadShortcuts()
    newTabPage.loadWidgets()
    newTabPage.renderReminders()
    newTabPage.renderShortcuts()
    newTabPage.renderWidgets()
    newTabPage.renderHistoryAndFavorites()
    newTabPage.bindQuickActions()
    newTabPage.bindSearch()
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


    if (newTabPage.addWidgetButton) {
      newTabPage.addWidgetButton.addEventListener('click', function () {
        newTabPage.promptAddWidget()
      })
    }

    if (newTabPage.widgetFilterInput) {
      newTabPage.widgetFilterInput.addEventListener('input', function () {
        newTabPage.renderWidgets()
      })
    }

    if (newTabPage.resetWidgetsButton) {
      newTabPage.resetWidgetsButton.addEventListener('click', function () {
        newTabPage.widgets = newTabPage.getDefaultWidgets()
        newTabPage.saveWidgets()
        newTabPage.renderWidgets()
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

    if (newTabPage.addShortcutButton) {
      newTabPage.addShortcutButton.addEventListener('click', function () {
        const result = ipc.sendSync('prompt', {
          text: 'Ajouter un raccourci',
          values: [
            { placeholder: 'Titre', id: 'title', type: 'text' },
            { placeholder: 'URL (https://...)', id: 'url', type: 'text' }
          ],
          ok: 'Ajouter',
          cancel: 'Annuler',
          height: 240
        })

        if (result && result.title && result.url) {
          newTabPage.shortcuts.push({
            title: result.title,
            url: newTabPage.normalizeURL(result.url)
          })
          newTabPage.saveShortcuts()
          newTabPage.renderShortcuts()
        }
      })
    }

    searchbar.events.on('url-selected', function () {
      newTabPage.scheduleHistoryRefresh()
    })

    newTabPage.updateLiveHeader()
    clearInterval(newTabPage.clockTimer)
    newTabPage.clockTimer = setInterval(newTabPage.updateLiveHeader, 60000)

    window.addEventListener('beforeunload', function () {
      newTabPage.clearWidgetTimers()
      clearInterval(newTabPage.clockTimer)
    })

    statistics.registerGetter('ntpHasBackground', function () {
      return newTabPage.hasBackground
    })
  }
}

module.exports = newTabPage
