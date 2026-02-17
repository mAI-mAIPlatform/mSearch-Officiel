var places = require('places/places.js')

function openURL (url) {
  window.location.href = url
}

async function render () {
  var list = document.getElementById('list')
  list.textContent = ''
  var items = await places.searchPlaces('', { limit: 200 })
  items = items.filter(function (item) { return !item.isBookmarked })

  if (!items.length) {
    var empty = document.createElement('li')
    empty.className = 'empty'
    empty.textContent = "Aucun historique n'est disponible pour le moment."
    list.appendChild(empty)
    return
  }

  items.sort(function (a, b) { return (b.lastVisit || 0) - (a.lastVisit || 0) })

  items.forEach(function (item) {
    var li = document.createElement('li')
    var left = document.createElement('div')
    var title = document.createElement('strong')
    title.textContent = item.title || item.url
    var meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = (item.url || '') + ' • ' + new Date(item.lastVisit || Date.now()).toLocaleString('fr-FR')
    left.appendChild(title)
    left.appendChild(meta)

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

document.getElementById('clear').addEventListener('click', function () {
  if (!window.confirm('Supprimer tout l\'historique ?')) {
    return
  }
  places.deleteAllHistory()
  setTimeout(render, 120)
})

render()
