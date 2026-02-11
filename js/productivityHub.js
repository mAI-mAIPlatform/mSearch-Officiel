const settings = require('util/settings/settings.js')

const NOTE_STORAGE_KEY = 'msearch.productivityHub.notes'
const TAB_FREEZE_IDLE_MS = 4 * 60 * 1000
const TAB_FREEZE_CHECK_INTERVAL_MS = 30 * 1000

const productivityHub = {
  notes: [],
  container: null,
  initialize: function () {
    productivityHub.createNotesLayer()
    productivityHub.loadNotes()
    productivityHub.renderNotes()
    productivityHub.bindShortcuts()
    productivityHub.initializeTabFreezing()
    productivityHub.initializeSmartHistoryBang()
    productivityHub.initializeDownloadSuggestions()
  },
  createNotesLayer: function () {
    const layer = document.createElement('div')
    layer.id = 'productivity-notes-layer'
    document.body.appendChild(layer)
    productivityHub.container = layer

    document.body.addEventListener('productivityhub:open-notes', function () {
      productivityHub.createNote({ text: '' })
    })
  },
  loadNotes: function () {
    try {
      const raw = localStorage.getItem(NOTE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      productivityHub.notes = Array.isArray(parsed) ? parsed.filter(Boolean).slice(0, 20) : []
    } catch (e) {
      productivityHub.notes = []
    }
  },
  saveNotes: function () {
    localStorage.setItem(NOTE_STORAGE_KEY, JSON.stringify(productivityHub.notes.slice(0, 20)))
  },
  createNote: function (note = {}) {
    const entry = {
      id: note.id || String(Date.now() + Math.random()),
      text: note.text || '',
      x: typeof note.x === 'number' ? note.x : 40,
      y: typeof note.y === 'number' ? note.y : 110
    }
    productivityHub.notes.unshift(entry)
    productivityHub.notes = productivityHub.notes.slice(0, 20)
    productivityHub.saveNotes()
    productivityHub.renderNotes()
  },
  removeNote: function (id) {
    productivityHub.notes = productivityHub.notes.filter(n => n.id !== id)
    productivityHub.saveNotes()
    productivityHub.renderNotes()
  },
  renderNotes: function () {
    if (!productivityHub.container) {
      return
    }

    productivityHub.container.textContent = ''

    productivityHub.notes.forEach(function (note) {
      const card = document.createElement('article')
      card.className = 'productivity-note glass-card'
      card.style.left = note.x + 'px'
      card.style.top = note.y + 'px'

      const header = document.createElement('header')
      header.className = 'productivity-note-header'
      header.textContent = 'Note rapide'

      const removeButton = document.createElement('button')
      removeButton.className = 'productivity-note-remove i carbon:close'
      removeButton.setAttribute('aria-label', 'Supprimer la note')
      removeButton.addEventListener('click', function () {
        productivityHub.removeNote(note.id)
      })
      header.appendChild(removeButton)

      const textarea = document.createElement('textarea')
      textarea.value = note.text
      textarea.placeholder = 'Écrire une note…'
      textarea.addEventListener('input', function () {
        note.text = textarea.value
        productivityHub.saveNotes()
      })

      productivityHub.makeDraggable(card, header, note)

      card.appendChild(header)
      card.appendChild(textarea)
      productivityHub.container.appendChild(card)
    })
  },
  makeDraggable: function (card, handle, note) {
    let isDragging = false
    let startX = 0
    let startY = 0

    handle.addEventListener('mousedown', function (event) {
      isDragging = true
      startX = event.clientX - note.x
      startY = event.clientY - note.y
      event.preventDefault()
    })

    window.addEventListener('mousemove', function (event) {
      if (!isDragging) {
        return
      }

      note.x = Math.max(8, event.clientX - startX)
      note.y = Math.max(54, event.clientY - startY)
      card.style.left = note.x + 'px'
      card.style.top = note.y + 'px'
    })

    window.addEventListener('mouseup', function () {
      if (!isDragging) {
        return
      }
      isDragging = false
      productivityHub.saveNotes()
    })
  },
  bindShortcuts: function () {
    document.addEventListener('keydown', function (event) {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyN') {
        productivityHub.createNote({ text: '' })
      }
    })
  },
  initializeTabFreezing: function () {
    if (settings.get('tabFreezingEnabled') === false) {
      return
    }

    setInterval(function () {
      const now = Date.now()
      const selectedTab = tabs.getSelected()

      tabs.get().forEach(function (tab) {
        const shouldFreeze = tab.id !== selectedTab && (now - (tab.lastActivity || now)) > TAB_FREEZE_IDLE_MS

        if (shouldFreeze && !tab.frozen) {
          tabs.update(tab.id, { frozen: true, muted: true })
          if (webviews.hasViewForTab(tab.id)) {
            webviews.callAsync(tab.id, 'setAudioMuted', true)
            webviews.callAsync(tab.id, 'setBackgroundThrottling', true)
          }
        }

        if (!shouldFreeze && tab.frozen) {
          tabs.update(tab.id, { frozen: false, muted: false })
          if (webviews.hasViewForTab(tab.id)) {
            webviews.callAsync(tab.id, 'setBackgroundThrottling', false)
          }
        }
      })
    }, TAB_FREEZE_CHECK_INTERVAL_MS)
  },
  initializeSmartHistoryBang: function () {
    const searchbarPlugins = require('searchbar/searchbarPlugins.js')
    const bangsPlugin = require('searchbar/bangsPlugin.js')
    const places = require('places/places.js')
    const searchbar = require('searchbar/searchbar.js')

    bangsPlugin.registerCustomBang({
      phrase: '!smart-history',
      snippet: 'Historique intelligent par contexte',
      icon: 'carbon:search-advanced',
      showSuggestions: async function (text) {
        const terms = text.trim().toLowerCase().split(/\s+/).filter(Boolean)
        const results = await places.searchPlaces(text, { limit: 250 })
        searchbarPlugins.reset('bangs')
        const container = searchbarPlugins.getContainer('bangs')

        results.filter(function (item) {
          if (!terms.length) {
            return true
          }
          const haystack = ((item.title || '') + ' ' + (item.url || '') + ' ' + (item.extractedText || '')).toLowerCase()
          return terms.every(term => haystack.includes(term))
        }).slice(0, 60).forEach(function (item, idx) {
          searchbarPlugins.addResult('bangs', {
            title: item.title || item.url,
            secondaryText: item.url,
            icon: item.url && item.url.includes('.pdf') ? 'carbon:document-pdf' : 'carbon:document',
            fakeFocus: idx === 0,
            click: function (e) {
              searchbar.openURL(item.url, e)
            }
          })
        })
        container.hidden = false
      }
    })
  },
  initializeDownloadSuggestions: function () {
    ipc.on('download-info', function (_e, info) {
      if (!info || !info.path || info.status !== 'completed') {
        return
      }

      const extension = info.path.split('.').pop().toLowerCase()
      if (['pdf', 'doc', 'docx', 'txt'].includes(extension)) {
        console.info('[productivityHub] Suggestion: classer ce document dans “Documents”.', info.path)
      }
    })
  }
}

module.exports = productivityHub
