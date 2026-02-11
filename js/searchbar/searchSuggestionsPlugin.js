var searchbarPlugins = require('searchbar/searchbarPlugins.js')

var urlParser = require('util/urlParser.js')
var searchEngine = require('util/searchEngine.js')

function normalizeSuggestionCount (value) {
  var parsedValue = Number.parseInt(value, 10)

  if (!Number.isInteger(parsedValue) || parsedValue < 1 || parsedValue > 8) {
    return 3
  }

  return parsedValue
}

function showSearchSuggestions (text, input, inputFlags) {
  if (settings.get('searchSuggestionsEnabled') === false) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  const suggestionsURL = searchEngine.getCurrent().suggestionsURL

  if (!suggestionsURL) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  if ((searchbarPlugins.getResultCount() - searchbarPlugins.getResultCount('searchSuggestions')) > 3) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  var suggestionCount = normalizeSuggestionCount(settings.get('searchSuggestionsCount'))

  fetch(suggestionsURL.replace('%s', encodeURIComponent(text)), {
    cache: 'force-cache'
  })
    .then(function (response) {
      return response.json()
    })
    .then(function (results) {
      searchbarPlugins.reset('searchSuggestions')

      if (searchbarPlugins.getResultCount() > 3) {
        return
      }

      if (results && Array.isArray(results[1])) {
        results = results[1].slice(0, suggestionCount)
        results.forEach(function (result) {
          var data = {
            title: result,
            url: result
          }

          if (urlParser.isPossibleURL(result)) { // website suggestions
            data.icon = 'carbon:earth-filled'
          } else { // regular search results
            data.icon = 'carbon:search'
          }

          searchbarPlugins.addResult('searchSuggestions', data)
        })
      }
    })
    .catch(function () {
      searchbarPlugins.reset('searchSuggestions')
    })
}

function initialize () {
  searchbarPlugins.register('searchSuggestions', {
    index: 4,
    trigger: function (text) {
      return !!text && text.indexOf('!') !== 0 && !tabs.get(tabs.getSelected()).private
    },
    showResults: debounce(showSearchSuggestions, 50)
  })
}

module.exports = { initialize }
