var places = require('places/places.js')

function normalizeURL (value) {
  var trimmed = (value || '').trim()
  if (!trimmed) return ''
  if (trimmed.includes('://') || trimmed.startsWith('about:') || trimmed.startsWith('min:')) return trimmed
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed)) return 'https://' + trimmed
  return trimmed
}

function openURL (url) {
  window.location.href = url
}

async function render () {
  var list = document.getElementById('list')
  list.textContent = ''
  var items = await places.searchPlaces('', { searchBookmarks: true, limit: Infinity })

  if (!items.length) {
    var empty = document.createElement('li')
    empty.className = 'empty'
    empty.textContent = "Aucun favoris n'est disponible pour le moment."
    list.appendChild(empty)
    return
  }

  items.sort(function (a, b) { return (b.lastVisit || 0) - (a.lastVisit || 0) })

  items.forEach(function (item) {
    var li = document.createElement('li')
    var left = document.createElement('div')
    var title = document.createElement('strong')
    title.textContent = item.title || item.url
    var url = document.createElement('div')
    url.className = 'url'
    url.textContent = item.url
    left.appendChild(title)
    left.appendChild(url)

    var openButton = document.createElement('button')
    openButton.textContent = 'Ouvrir'
    openButton.addEventListener('click', function () { openURL(item.url) })

    var removeButton = document.createElement('button')
    removeButton.textContent = 'Supprimer'
    removeButton.addEventListener('click', function () {
      places.deleteHistory(item.url)
      render()
    })

    li.appendChild(left)
    li.appendChild(openButton)
    li.appendChild(removeButton)
    list.appendChild(li)
  })
}

document.getElementById('add').addEventListener('click', async function () {
  var titleInput = document.getElementById('title')
  var urlInput = document.getElementById('url')
  var url = normalizeURL(urlInput.value)
  var title = (titleInput.value || '').trim()
  if (!url) return

  await places.updateItem(url, {
    title: title || url,
    isBookmarked: true,
    tags: ['favori'],
    lastVisit: Date.now()
  })

  titleInput.value = ''
  urlInput.value = ''
  render()
})

render()
