var searchbar = require('searchbar/searchbar.js')
var searchbarPlugins = require('searchbar/searchbarPlugins.js')
var searchbarUtils = require('searchbar/searchbarUtils.js')
var bangsPlugin = require('searchbar/bangsPlugin.js')
var places = require('places/places.js')
var urlParser = require('util/urlParser.js')
var formatRelativeDate = require('util/relativeDate.js')

function parseHistoryFilters (text) {
  const tokens = (text || '').toLowerCase().split(' ').filter(Boolean)
  const filters = {
    type: null,
    date: null,
    context: []
  }

  tokens.forEach(function (token) {
    if (token.startsWith('type:')) {
      filters.type = token.replace('type:', '')
      return
    }

    if (token.startsWith('date:')) {
      filters.date = token.replace('date:', '')
      return
    }

    filters.context.push(token)
  })

  return filters
}

function matchesSmartFilters (result, filters) {
  const haystack = ((result.title || '') + ' ' + (result.url || '')).toLowerCase()
  const isPDF = haystack.includes('.pdf') || haystack.includes('pdf')

  if (filters.type === 'pdf' && !isPDF) {
    return false
  }

  if (filters.type === 'video' && !(haystack.includes('youtube') || haystack.includes('vimeo'))) {
    return false
  }

  if (filters.date === 'today') {
    const visitDate = new Date(result.lastVisit || 0)
    if (visitDate.toDateString() !== new Date().toDateString()) {
      return false
    }
  }

  return filters.context.every(function (part) {
    return haystack.includes(part)
  })
}


module.exports = {
  initialize: function () {
    bangsPlugin.registerCustomBang({
      phrase: '!history',
      snippet: l('searchHistory') + ' (type:pdf date:today contexte)',
      icon: 'carbon:recently-viewed',
      isAction: false,
      showSuggestions: async function (text, input, event) {
        const results = await places.searchPlaces(text, { limit: Infinity })
        const filters = parseHistoryFilters(text)

        searchbarPlugins.reset('bangs')

        var container = searchbarPlugins.getContainer('bangs')

        // show clear button

        if (text === '' && results.length > 0) {
          var clearButton = document.createElement('button')
          clearButton.className = 'searchbar-floating-button'
          clearButton.textContent = l('clearHistory')
          container.appendChild(clearButton)

          clearButton.addEventListener('click', function () {
            if (confirm(l('clearHistoryConfirmation'))) {
              places.deleteAllHistory()
              ipc.invoke('clearStorageData')

              // hacky way to refresh the list
              // TODO make a better api for this
              setTimeout(function () {
                searchbarPlugins.run('!history ' + text, input, null)
              }, 200)
            }
          })
        }

        // show results

        var lazyList = searchbarUtils.createLazyList(container.parentNode)

        var lastRelativeDate = '' // used to generate headings

        results.filter(function (result) { return matchesSmartFilters(result, filters) }).sort(function (a, b) {
          // order by last visit
          return b.lastVisit - a.lastVisit
        }).slice(0, 1000).forEach(function (result, index) {
          var thisRelativeDate = formatRelativeDate(result.lastVisit)
          if (thisRelativeDate !== lastRelativeDate) {
            searchbarPlugins.addHeading('bangs', { text: thisRelativeDate })
            lastRelativeDate = thisRelativeDate
          }
          var data = {
            title: result.title,
            secondaryText: urlParser.basicURL(urlParser.getSourceURL(result.url)) + ' · ' + (matchesSmartFilters(result, { type: 'pdf', date: null, context: [] }) ? 'PDF' : 'Web'),
            fakeFocus: index === 0 && text,
            icon: (result.isBookmarked ? 'carbon:star' : ''),
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
