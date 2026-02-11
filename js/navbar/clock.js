var settings = require('util/settings/settings.js')

var clockContainer

function updateClock () {
  if (!clockContainer) return
  var now = new Date()
  clockContainer.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function initialize () {
  clockContainer = document.createElement('div')
  clockContainer.id = 'navbar-clock'
  clockContainer.hidden = true

  var navbar = document.getElementById('navbar')
  var rightActions = document.querySelector('.navbar-right-actions')

  if (navbar && rightActions) {
    navbar.insertBefore(clockContainer, rightActions)
  } else if (navbar) {
    navbar.appendChild(clockContainer)
  }

  setInterval(updateClock, 1000)
  updateClock()

  settings.get('showClock', function (value) {
    clockContainer.hidden = !value
  })

  settings.listen('showClock', function (value) {
    clockContainer.hidden = !value
  })
}

module.exports = { initialize }
