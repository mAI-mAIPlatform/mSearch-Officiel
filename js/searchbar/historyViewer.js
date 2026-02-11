var searchbar = require('searchbar/searchbar.js')
var searchbarPlugins = require('searchbar/searchbarPlugins.js')
var searchbarUtils = require('searchbar/searchbarUtils.js')
var bangsPlugin = require('searchbar/bangsPlugin.js')
var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var formatRelativeDate = require('util/relativeDate.js')

function parseHistoryFilters (text) {
  const raw = (text || '').trim()
  const typeMatch = raw.match(/(?:^|\s)type:([^\s]+)/i)
  const dateMatch = raw.match(/(?:^|\s)date:([^\s]+)/i)

  const query = raw
    .replace(/(?:^|\s)type:[^\s]+/ig, ' ')
    .replace(/(?:^|\s)date:[^\s]+/ig, ' ')
    .trim()

  return {
    type: typeMatch ? typeMatch[1].toLowerCase() : '',
    date: dateMatch ? dateMatch[1].toLowerCase() : '',
    query: query.toLowerCase()
  }
}

function getHistoryItemType (result) {
  const title = (result.title || '').toLowerCase()
  const url = (result.url || '').toLowerCase()

  if (url.endsWith('.pdf') || url.includes('/pdf') || title.includes('pdf')) {
    return 'pdf'
  }

  if (result.isBookmarked) {
    return 'bookmark'
  }

  return 'web'
}

function matchesDateFilter (result, dateFilter) {
  if (!dateFilter) {
    return true
  }

  const visitDate = new Date(result.lastVisit || 0)
  const today = new Date()

  if (dateFilter === 'today' || dateFilter === 'aujourdhui' || dateFilter === 'aujourd\'hui') {
    return visitDate.toDateString() === today.toDateString()
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
    return visitDate.toISOString().slice(0, 10) === dateFilter
  }

  return visitDate.toLocaleDateString('fr-FR').toLowerCase().includes(dateFilter)
}

function matchesQuery (result, query) {
  if (!query) {
    return true
  }
  const haystack = ((result.title || '') + ' ' + (result.url || '') + ' ' + (result.extractedText || '')).toLowerCase()
  return haystack.includes(query)
}

module.exports = {
  initialize: function () {
    bangsPlugin.registerCustomBang({
      phrase: '!history',
      snippet: l('searchHistory'),
      icon: 'carbon:recently-viewed',
      isAction: false,
      showSuggestions: async function (text, input, event) {
        const filters = parseHistoryFilters(text)
        const results = await places.searchPlaces(filters.query, { limit: Infinity })

        searchbarPlugins.reset('bangs')

        var container = searchbarPlugins.getContainer('bangs')

        if (text === '' && results.length > 0) {
          var clearButton = document.createElement('button')
          clearButton.className = 'searchbar-floating-button'
          clearButton.textContent = l('clearHistory')
          container.appendChild(clearButton)

          clearButton.addEventListener('click', function () {
            if (confirm(l('clearHistoryConfirmation'))) {
              places.deleteAllHistory()
              ipc.invoke('clearStorageData')

              setTimeout(function () {
                searchbarPlugins.run('!history ' + text, input, null)
              }, 200)
            }
          })
        }

        var lazyList = searchbarUtils.createLazyList(container.parentNode)
        var lastRelativeDate = ''

        results
          .filter(function (result) {
            const itemType = getHistoryItemType(result)
            const typeMatch = !filters.type || itemType === filters.type
            return typeMatch && matchesDateFilter(result, filters.date) && matchesQuery(result, filters.query)
          })
          .sort(function (a, b) {
            return b.lastVisit - a.lastVisit
          })
          .slice(0, 1000)
          .forEach(function (result, index) {
            var thisRelativeDate = formatRelativeDate(result.lastVisit)
            if (thisRelativeDate !== lastRelativeDate) {
              searchbarPlugins.addHeading('bangs', { text: thisRelativeDate })
              lastRelativeDate = thisRelativeDate
            }

            var typeTag = getHistoryItemType(result)
            var data = {
              title: result.title,
              secondaryText: urlParser.basicURL(urlParser.getSourceURL(result.url)) + ' · ' + typeTag,
              fakeFocus: index === 0 && text,
              icon: typeTag === 'pdf' ? 'carbon:document-pdf' : (result.isBookmarked ? 'carbon:star' : ''),
              click: function (e) {
                searchbar.openURL(result.url, e)
              },
              delete: function () {
                places.deleteHistory(result.url)
              },
              showDeleteButton: true
            }
            var placeholder = lazyList.createPlaceholder()
            container.appendChild(placeholder)
            lazyList.lazyRenderItem(placeholder, data)
          })
      },
      fn: function (text) {
        if (!text) {
          return
        }
        places.searchPlaces(text, { limit: Infinity })
          .then(function (results) {
            if (results.length !== 0) {
              results = results.sort(function (a, b) {
                return b.lastVisit - a.lastVisit
              })
              searchbar.openURL(results[0].url, null)
            }
          })
      }
    })
  }
}
