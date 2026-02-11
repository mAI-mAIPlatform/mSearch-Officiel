const path = require('path')
const statistics = require('js/statistics.js')
const places = require('places/places.js')
const searchbar = require('searchbar/searchbar.js')
const tabEditor = require('navbar/tabEditor.js')

const REMINDER_STORAGE_KEY = 'msearch.ntp.reminders'
const THEME_STORAGE_KEY = 'msearch.ntp.theme'
const MAX_REMINDERS = 12

const themes = {
  aurora: 'linear-gradient(120deg, rgba(49, 87, 255, 0.45), rgba(65, 230, 180, 0.25), rgba(203, 124, 255, 0.35))',
  ocean: 'linear-gradient(120deg, rgba(6, 80, 204, 0.5), rgba(44, 167, 210, 0.25), rgba(15, 42, 100, 0.45))',
  sunset: 'linear-gradient(120deg, rgba(232, 124, 32, 0.5), rgba(222, 80, 130, 0.35), rgba(103, 34, 167, 0.4))'
}

const newTabPage = {
  background: document.getElementById('ntp-background'),
  backgroundOverlay: document.getElementById('ntp-gradient-overlay'),
  hasBackground: false,
  picker: document.getElementById('ntp-image-picker'),
  deleteBackground: document.getElementById('ntp-image-remove'),
  themeSelector: document.getElementById('ntp-theme-selector'),
  reminderForm: document.getElementById('ntp-reminder-form'),
  reminderInput: document.getElementById('ntp-reminder-input'),
  reminderList: document.getElementById('ntp-reminder-list'),
  favoritesList: document.getElementById('ntp-favorites-list'),
  historyList: document.getElementById('ntp-history-list'),
  actionButtons: document.querySelectorAll('[data-ntp-action]'),
  imagePath: path.join(window.globalArgs['user-data-path'], 'newTabBackground'),
  blobInstance: null,
  reminders: [],
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
      newTabPage.reminderList.appendChild(item)
    })
  },
  createPageListItem: function (item) {
    const listItem = document.createElement('li')
    listItem.className = 'ntp-list-item'

    const link = document.createElement('button')
    link.className = 'ntp-link-button'
    link.textContent = item.title || item.url
    link.title = item.url

    link.addEventListener('click', function () {
      searchbar.events.emit('url-selected', { url: item.url, background: false })
    })

    listItem.appendChild(link)
    return listItem
  },
  renderHistoryAndFavorites: async function () {
    if (!newTabPage.favoritesList || !newTabPage.historyList) {
      return
    }

    newTabPage.favoritesList.textContent = ''
    newTabPage.historyList.textContent = ''

    try {
      const items = await places.getAllItems()
      const sortedByVisit = items.slice().sort((a, b) => (b.lastVisit || 0) - (a.lastVisit || 0))
      const favorites = sortedByVisit.filter(item => item.isBookmarked).slice(0, 6)
      const historyItems = sortedByVisit.filter(item => !item.isBookmarked).slice(0, 6)

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

      if (historyItems.length === 0) {
        const emptyHistory = document.createElement('li')
        emptyHistory.className = 'ntp-empty-state'
        emptyHistory.textContent = 'Votre historique récent apparaîtra ici.'
        newTabPage.historyList.appendChild(emptyHistory)
      } else {
        historyItems.forEach(item => {
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
  reloadBackground: function () {
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
        }
      })
    })
  },
  initialize: function () {
    newTabPage.applyTheme(newTabPage.getSelectedTheme())
    newTabPage.reloadBackground()
    newTabPage.loadReminders()
    newTabPage.renderReminders()
    newTabPage.renderHistoryAndFavorites()
    newTabPage.bindQuickActions()

    newTabPage.picker.addEventListener('click', async function () {
      const filePath = await ipc.invoke('showOpenDialog', {
        filters: [
          { name: 'Image files', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
        ]
      })

      if (!filePath) {
        return
      }

      await fs.promises.copyFile(filePath[0], newTabPage.imagePath)
      newTabPage.reloadBackground()
    })

    newTabPage.deleteBackground.addEventListener('click', async function () {
      try {
        await fs.promises.unlink(newTabPage.imagePath)
      } catch (e) {
        if (e.code !== 'ENOENT') {
          throw e
        }
      }
      newTabPage.reloadBackground()
    })

    newTabPage.themeSelector.addEventListener('change', function () {
      newTabPage.applyTheme(newTabPage.themeSelector.value)
    })

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

    searchbar.events.on('url-selected', function () {
      newTabPage.renderHistoryAndFavorites()
    })

    statistics.registerGetter('ntpHasBackground', function () {
      return newTabPage.hasBackground
    })
  }
}

module.exports = newTabPage
