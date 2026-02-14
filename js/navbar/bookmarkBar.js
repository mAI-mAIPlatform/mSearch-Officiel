const places = require('places/places.js')
const settings = require('util/settings/settings.js')
const searchbar = require('searchbar/searchbar.js')

const bookmarkBar = {
  container: document.getElementById('bookmarks-bar'),
  initialize: function () {
    if (!this.container) {
      return
    }

    this.updateVisibility()

    settings.listen('showBookmarksBar', (value) => {
      this.updateVisibility()
    })

    searchbar.events.on('url-selected', () => {
      if (this.isVisible()) {
        setTimeout(() => this.render(), 500)
      }
    })
  },
  isVisible: function () {
    return settings.get('showBookmarksBar') === true
  },
  updateVisibility: function () {
    const visible = this.isVisible()
    this.container.hidden = !visible
    if (visible) {
      document.body.style.setProperty('--bookmarks-bar-height', '28px')
      this.render()
    } else {
      document.body.style.removeProperty('--bookmarks-bar-height')
    }
  },
  render: async function () {
    this.container.textContent = ''
    try {
      const results = await places.searchPlaces('', { searchBookmarks: true, limit: 100 })

      results.forEach(item => {
        if (!item.isBookmarked) return

        const el = document.createElement('a')
        el.className = 'bookmark-item'
        el.href = item.url
        el.title = item.title || item.url

        const icon = document.createElement('span')
        icon.className = 'bookmark-icon'
        try {
          const domain = new URL(item.url).hostname
          icon.style.backgroundImage = `url(https://www.google.com/s2/favicons?domain=${domain}&sz=32)`
        } catch (e) {}

        const title = document.createElement('span')
        title.className = 'bookmark-title'
        title.textContent = item.title || item.url

        el.appendChild(icon)
        el.appendChild(title)

        el.addEventListener('click', (e) => {
          e.preventDefault()
          searchbar.events.emit('url-selected', { url: item.url, background: e.metaKey || e.ctrlKey })
        })

        this.container.appendChild(el)
      })
    } catch (e) {
      console.error(e)
    }
  }
}

module.exports = bookmarkBar
