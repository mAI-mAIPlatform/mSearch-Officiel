if (typeof require !== 'undefined') {
  var settings = require('util/settings/settings.js')
}
// otherwise, assume window.settings exists already

var currentSearchEngine = {
  name: '',
  searchURL: '%s'
}

var defaultSearchEngine = 'DuckDuckGo'
var defaultSearchOptions = {
  region: 'fr-FR',
  language: 'fr',
  safeMode: 'moderate',
  extraParams: ''
}

var searchEngines = {
  DuckDuckGo: {
    name: 'DuckDuckGo',
    searchURL: 'https://duckduckgo.com/?q=%s&t=min',
    suggestionsURL: 'https://ac.duckduckgo.com/ac/?q=%s&type=list&t=min',
    queryParam: 'q'
  },
  Google: {
    name: 'Google',
    searchURL: 'https://www.google.com/search?q=%s',
    queryParam: 'q'
  },
  Bing: {
    name: 'Bing',
    searchURL: 'https://www.bing.com/search?q=%s',
    suggestionsURL: 'https://www.bing.com/osjson.aspx?query=%s',
    queryParam: 'q'
  },
  Yahoo: {
    name: 'Yahoo',
    searchURL: 'https://search.yahoo.com/yhs/search?p=%s',
    suggestionsURL: 'https://search.yahoo.com/sugg/os?command=%s&output=fxjson',
    queryParam: 'p'
  },
  Baidu: {
    name: 'Baidu',
    searchURL: 'https://www.baidu.com/s?wd=%s',
    suggestionsURL: 'https://www.baidu.com/su?wd=%s&action=opensearch&ie=utf-8',
    queryParam: 'wd'
  },
  StartPage: {
    name: 'StartPage',
    searchURL: 'https://www.startpage.com/do/search?q=%s',
    suggestionsURL: 'https://www.startpage.com/cgi-bin/csuggest?query=%s&format=json',
    queryParam: 'q'
  },
  Ecosia: {
    name: 'Ecosia',
    searchURL: 'https://www.ecosia.org/search?q=%s',
    suggestionsURL: 'https://ac.ecosia.org/autocomplete?q=%s&type=list',
    queryParam: 'q'
  },
  Qwant: {
    name: 'Qwant',
    searchURL: 'https://www.qwant.com/?q=%s',
    suggestionsURL: 'https://api.qwant.com/api/suggest/?q=%s&client=opensearch',
    queryParam: 'q'
  },
  Wikipedia: {
    name: 'Wikipedia',
    searchURL: 'https://wikipedia.org/w/index.php?search=%s',
    suggestionsURL: 'https://wikipedia.org/w/api.php?action=opensearch&search=%s',
    queryParam: 'search'
  },
  Yandex: {
    name: 'Yandex',
    searchURL: 'https://yandex.com/search/?text=%s',
    suggestionsURL: 'https://suggest.yandex.com/suggest-ff.cgi?part=%s',
    queryParam: 'text'
  },
  Brave: {
    name: 'Brave',
    searchURL: 'https://search.brave.com/search?q=%s',
    suggestionsURL: 'https://search.brave.com/api/suggest?q=%s',
    queryParam: 'q'
  },
  SearXNG: {
    name: 'SearXNG',
    searchURL: 'https://searx.be/search?q=%s',
    queryParam: 'q'
  },
  Swisscows: {
    name: 'Swisscows',
    searchURL: 'https://swisscows.com/web?query=%s',
    queryParam: 'query'
  },
  Mojeek: {
    name: 'Mojeek',
    searchURL: 'https://www.mojeek.com/search?q=%s',
    queryParam: 'q'
  },
  You: {
    name: 'You',
    searchURL: 'https://you.com/search?q=%s',
    queryParam: 'q'
  },
  Naver: {
    name: 'Naver',
    searchURL: 'https://search.naver.com/search.naver?query=%s',
    queryParam: 'query'
  },
  none: {
    name: 'none',
    searchURL: 'http://%s'
  }
}

function sanitizeCustomSearchEngine (engine) {
  if (!engine || typeof engine !== 'object') {
    return null
  }

  var name = typeof engine.name === 'string' ? engine.name.trim() : ''
  var searchURL = typeof engine.searchURL === 'string' ? engine.searchURL.trim() : ''
  var suggestionsURL = typeof engine.suggestionsURL === 'string' ? engine.suggestionsURL.trim() : ''

  if (!name || !searchURL || !searchURL.includes('%s')) {
    return null
  }

  return {
    name: name,
    searchURL: searchURL,
    suggestionsURL: suggestionsURL || undefined,
    queryParam: 'q',
    custom: true
  }
}

function updateCustomSearchEngines (items) {
  Object.keys(searchEngines).forEach(function (key) {
    if (searchEngines[key] && searchEngines[key].custom && !searchEngines[key].builtIn) {
      delete searchEngines[key]
    }
  })

  if (!Array.isArray(items)) {
    return
  }

  items.forEach(function (item) {
    var safeEngine = sanitizeCustomSearchEngine(item)
    if (!safeEngine) {
      return
    }
    var key = safeEngine.name
    searchEngines[key] = safeEngine
    try {
      searchEngines[key].urlObj = new URL(searchEngines[key].searchURL)
    } catch (e) {}
  })
}

function normalizeSearchOptions (value) {
  if (!value || typeof value !== 'object') {
    return { ...defaultSearchOptions }
  }

  return {
    region: value.region || defaultSearchOptions.region,
    language: value.language || defaultSearchOptions.language,
    safeMode: value.safeMode || defaultSearchOptions.safeMode,
    extraParams: typeof value.extraParams === 'string' ? value.extraParams.trim() : ''
  }
}

function parseExtraParams (extraParams) {
  if (!extraParams) {
    return {}
  }

  var params = {}
  extraParams.split('&').forEach(function (part) {
    var trimmed = part.trim()
    if (!trimmed) {
      return
    }
    var equalIndex = trimmed.indexOf('=')
    if (equalIndex === -1) {
      return
    }
    var key = trimmed.slice(0, equalIndex).trim()
    var value = trimmed.slice(equalIndex + 1).trim()
    if (key) {
      params[key] = value
    }
  })
  return params
}

function getEngineSpecificParams (engineName, options, isSuggestionURL) {
  var region = options.region || defaultSearchOptions.region
  var language = options.language || defaultSearchOptions.language
  var safeMode = options.safeMode || defaultSearchOptions.safeMode
  var params = {}

  if (engineName === 'DuckDuckGo') {
    params.kl = region === 'all' ? 'wt-wt' : region.toLowerCase()
    params.kp = safeMode === 'strict' ? '1' : (safeMode === 'off' ? '-2' : '-1')
  } else if (engineName === 'Google') {
    if (region !== 'all') {
      params.gl = region.split('-')[1] ? region.split('-')[1].toLowerCase() : region.toLowerCase()
      params.hl = region.toLowerCase()
    }
    if (language !== 'all') {
      params.lr = 'lang_' + language.toLowerCase()
    }
    params.safe = safeMode === 'off' ? 'off' : 'active'
  } else if (engineName === 'Bing') {
    if (region !== 'all') {
      var country = region.split('-')[1] ? region.split('-')[1].toLowerCase() : region.toLowerCase()
      params.cc = country
      params.mkt = region.toLowerCase()
      params.setlang = region.toLowerCase()
    }
    params.adlt = safeMode === 'strict' ? 'strict' : (safeMode === 'off' ? 'off' : 'moderate')
  } else if (engineName === 'Qwant') {
    params.locale = region === 'all' ? 'fr_FR' : region.replace('-', '_')
    if (safeMode === 'strict') {
      params.t = 'web'
    }
  } else if (engineName === 'Brave') {
    if (region !== 'all') {
      params.country = region.split('-')[1] ? region.split('-')[1].toUpperCase() : region.toUpperCase()
    }
    if (!isSuggestionURL && language !== 'all') {
      params.hl = language.toLowerCase()
    }
    params.safe = safeMode
  } else if (engineName === 'Wikipedia' && language !== 'all') {
    params.uselang = language.toLowerCase()
  }

  return params
}

function getSearchOptionsSetting () {
  if (!settings || typeof settings.get !== 'function') {
    return { ...defaultSearchOptions }
  }

  // The settings content page exposes an async API; keep deterministic defaults there.
  if (settings.get.length > 1) {
    return { ...defaultSearchOptions }
  }

  return normalizeSearchOptions(settings.get('searchEngineOptions'))
}

function applySearchOptionsToURL (baseURL, query, isSuggestionURL) {
  if (!baseURL) {
    return ''
  }

  var encodedQuery = encodeURIComponent(query)
  var urlWithQuery = baseURL.replace('%s', encodedQuery)
  var searchOptions = getSearchOptionsSetting()

  try {
    var parsedURL = new URL(urlWithQuery)
    var engineName = currentSearchEngine.name || defaultSearchEngine
    var mergedParams = {
      ...getEngineSpecificParams(engineName, searchOptions, isSuggestionURL),
      ...parseExtraParams(searchOptions.extraParams)
    }

    Object.keys(mergedParams).forEach(function (key) {
      if (mergedParams[key] !== undefined && mergedParams[key] !== null && mergedParams[key] !== '') {
        parsedURL.searchParams.set(key, mergedParams[key])
      }
    })

    return parsedURL.toString()
  } catch (e) {
    return urlWithQuery
  }
}

for (const e in searchEngines) {
  try {
    searchEngines[e].urlObj = new URL(searchEngines[e].searchURL)
  } catch (e) {}
}

if (settings && typeof settings.listen === 'function') {
  settings.listen('customSearchEngines', function (value) {
    updateCustomSearchEngines(value)
  })
}

if (settings && typeof settings.get === 'function') {
  settings.get('customSearchEngines', function (value) {
    updateCustomSearchEngines(value)
  })
}

settings.listen('searchEngine', function (value) {
  if (value && value.name) {
    currentSearchEngine = searchEngines[value.name]
  } else if (value && value.url) {
    var searchDomain
    try {
      searchDomain = new URL(value.url).hostname.replace('www.', '')
    } catch (e) {}
    currentSearchEngine = {
      name: searchDomain || 'custom',
      searchURL: value.url,
      suggestionsURL: value.suggestionsURL,
      queryParam: 'q',
      custom: true
    }
  } else {
    currentSearchEngine = searchEngines[defaultSearchEngine]
  }
})

var searchEngine = {
  getCurrent: function () {
    return currentSearchEngine
  },
  getSearch: function (url) {
    var urlObj
    try {
      urlObj = new URL(url)
    } catch (e) {
      return null
    }
    for (var e in searchEngines) {
      if (!searchEngines[e].urlObj) {
        continue
      }
      if (searchEngines[e].urlObj.hostname === urlObj.hostname && searchEngines[e].urlObj.pathname === urlObj.pathname) {
        if (urlObj.searchParams.get(searchEngines[e].queryParam)) {
          return {
            engine: searchEngines[e].name,
            search: urlObj.searchParams.get(searchEngines[e].queryParam)
          }
        }
      }
    }
    return null
  },
  buildSearchURL: function (query) {
    return applySearchOptionsToURL(currentSearchEngine.searchURL, query, false)
  },
  buildSuggestionsURL: function (query) {
    if (!currentSearchEngine.suggestionsURL) {
      return null
    }
    return applySearchOptionsToURL(currentSearchEngine.suggestionsURL, query, true)
  }
}

if (typeof module === 'undefined') {
  window.currentSearchEngine = currentSearchEngine
  window.searchEngine = searchEngine
  window.searchEngines = searchEngines
} else {
  module.exports = searchEngine
  if (typeof window !== 'undefined') {
    window.searchEngines = searchEngines
  }
}
