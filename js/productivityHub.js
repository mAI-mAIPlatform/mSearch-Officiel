var webviews = require('webviews.js')
var searchbarPlugins = require('searchbar/searchbarPlugins.js')
var places = require('places/places.js')

const NOTES_STORAGE_KEY = 'msearch.floatingNotes'
const FREEZE_IDLE_MS = 2 * 60 * 1000

const productivityHub = {
  notesToggle: document.getElementById('floating-notes-toggle'),
  notesPanel: document.getElementById('floating-notes-panel'),
  notesClose: document.getElementById('floating-notes-close'),
  notesList: document.getElementById('floating-notes-list'),
  notesAddButton: document.getElementById('floating-notes-add'),
  smartSuggestion: document.getElementById('download-smart-suggestion'),
  notes: [],
  freezeInterval: null,
  loadNotes: function () {
    try {
      const raw = localStorage.getItem(NOTES_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      productivityHub.notes = Array.isArray(parsed) ? parsed.filter(n => n && typeof n.text === 'string').slice(0, 15) : []
    } catch (e) {
      productivityHub.notes = []
    }
  },
  saveNotes: function () {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(productivityHub.notes.slice(0, 15)))
  },
  renderNotes: function () {
    if (!productivityHub.notesList) {
      return
    }

    productivityHub.notesList.textContent = ''

    if (productivityHub.notes.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'ntp-empty-state'
      empty.textContent = 'Ajoutez une note liée à votre page actuelle.'
      productivityHub.notesList.appendChild(empty)
      return
    }

    productivityHub.notes.forEach(function (note, index) {
      const wrapper = document.createElement('div')
      wrapper.className = 'floating-note'

      const textarea = document.createElement('textarea')
      textarea.value = note.text
      textarea.placeholder = 'Votre note…'
      textarea.addEventListener('input', function () {
        productivityHub.notes[index].text = textarea.value
        productivityHub.notes[index].updatedAt = Date.now()
        productivityHub.saveNotes()
      })

      wrapper.appendChild(textarea)
      productivityHub.notesList.appendChild(wrapper)
    })
  },
  createNote: function () {
    const tab = tabs.get(tabs.getSelected()) || {}
    productivityHub.notes.unshift({
      text: '',
      tabTitle: tab.title || '',
      tabURL: tab.url || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    })
    productivityHub.notes = productivityHub.notes.slice(0, 15)
    productivityHub.saveNotes()
    productivityHub.renderNotes()

    const firstInput = productivityHub.notesList.querySelector('textarea')
    if (firstInput) {
      firstInput.focus()
    }
  },
  initializeFloatingNotes: function () {
    if (!productivityHub.notesPanel || !productivityHub.notesToggle) {
      return
    }

    productivityHub.loadNotes()
    productivityHub.renderNotes()

    productivityHub.notesToggle.addEventListener('click', function () {
      const shouldShow = productivityHub.notesPanel.hidden
      productivityHub.notesPanel.hidden = !shouldShow
      if (shouldShow) {
        productivityHub.renderNotes()
      }
    })

    productivityHub.notesClose.addEventListener('click', function () {
      productivityHub.notesPanel.hidden = true
    })

    productivityHub.notesAddButton.addEventListener('click', function () {
      productivityHub.createNote()
    })
  },
  updateDownloadSuggestion: function (downloadInfo) {
    if (!productivityHub.smartSuggestion || !downloadInfo || !downloadInfo.path) {
      return
    }

    const extension = (downloadInfo.path.split('.').pop() || '').toLowerCase()
    const suggestedFolder = {
      pdf: 'Documents',
      doc: 'Documents',
      docx: 'Documents',
      xls: 'Feuilles',
      xlsx: 'Feuilles',
      png: 'Images',
      jpg: 'Images',
      jpeg: 'Images',
      zip: 'Archives'
    }[extension] || 'Téléchargements'

    productivityHub.smartSuggestion.textContent = 'Suggestion: classer dans « ' + suggestedFolder + ' »'
  },
  initializeSmartDownloads: function () {
    ipc.on('download-info', function (e, info) {
      productivityHub.updateDownloadSuggestion(info)
    })
  },
  initializeSmartHistoryBang: function () {
    searchbarPlugins.register('smartHistory', {
      index: 0,
      trigger: function (text) {
        return text.startsWith('!smart-history ')
      },
      showResults: async function (text) {
        searchbarPlugins.reset('smartHistory')
        const query = text.replace('!smart-history ', '').trim().toLowerCase()
        if (!query) {
          return
        }

        const parts = query.split(' ').filter(Boolean)
        const items = await places.searchPlaces(query, { limit: 120 })
        const filtered = items.filter(function (item) {
          const haystack = ((item.title || '') + ' ' + (item.url || '')).toLowerCase()
          const isPDF = haystack.includes('.pdf') || haystack.includes('pdf')
          const visitDate = new Date(item.lastVisit || 0)
          const today = new Date()
          const sameDay = visitDate.toDateString() === today.toDateString()

          const matchesParts = parts.every(function (part) {
            if (part === 'pdf') {
              return isPDF
            }
            if (part === 'today' || part === "aujourd'hui") {
              return sameDay
            }
            return haystack.includes(part)
          })

          return matchesParts
        }).slice(0, 10)

        if (filtered.length === 0) {
          searchbarPlugins.addResult('smartHistory', {
            title: 'Aucun résultat intelligent',
            secondaryText: 'Essayez avec des termes comme: pdf, today, news, fichier',
            fakeFocus: false
          })
          return
        }

        filtered.forEach(function (item, index) {
          searchbarPlugins.addResult('smartHistory', {
            title: item.title || item.url,
            secondaryText: item.url,
            fakeFocus: index === 0,
            icon: item.url.includes('.pdf') ? 'carbon:document-pdf' : 'carbon:recently-viewed',
            click: function (e) {
              require('searchbar/searchbar.js').openURL(item.url, e)
            }
          })
        })
      }
    })
  },
  runTabFreezing: function () {
    const selectedId = tabs.getSelected()
    tabs.get().forEach(function (tab) {
      if (!tab.id || tab.id === selectedId || !tab.hasWebContents) {
        return
      }

      const inactiveFor = Date.now() - (tab.lastActivity || Date.now())
      const shouldFreeze = inactiveFor > FREEZE_IDLE_MS

      if (shouldFreeze && !tab.frozen) {
        webviews.callAsync(tab.id, 'setBackgroundThrottling', [true])
        webviews.callAsync(tab.id, 'setAudioMuted', [true])
        tabs.update(tab.id, { frozen: true }, false)
      }

      if (!shouldFreeze && tab.frozen) {
        webviews.callAsync(tab.id, 'setBackgroundThrottling', [false])
        tabs.update(tab.id, { frozen: false }, false)
      }
    })

    if (selectedId && tabs.get(selectedId)?.frozen) {
      webviews.callAsync(selectedId, 'setBackgroundThrottling', [false])
      webviews.callAsync(selectedId, 'setAudioMuted', [false])
      tabs.update(selectedId, { frozen: false }, false)
    }
  },
  initializeTabFreezing: function () {
    productivityHub.freezeInterval = setInterval(function () {
      productivityHub.runTabFreezing()
    }, 15000)

    tasks.on('tab-selected', function () {
      productivityHub.runTabFreezing()
    })
  },
  initialize: function () {
    productivityHub.initializeFloatingNotes()
    productivityHub.initializeSmartDownloads()
    productivityHub.initializeSmartHistoryBang()
    productivityHub.initializeTabFreezing()
  }
}

module.exports = productivityHub
