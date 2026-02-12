const urlParser = require('util/urlParser.js')

const permissionPopup = {
  container: document.getElementById('permission-popup'),
  isShown: false,
  initialize: function () {
    // Create container if not exists
    if (!permissionPopup.container) {
      permissionPopup.container = document.createElement('div')
      permissionPopup.id = 'permission-popup'
      permissionPopup.className = 'permission-popup'
      permissionPopup.hidden = true
      document.body.appendChild(permissionPopup.container)
    }

    // Hide on click outside
    document.addEventListener('click', function (e) {
      if (permissionPopup.isShown && !permissionPopup.container.contains(e.target) && !e.target.closest('.tab-icon-area') && !e.target.closest('.permission-popup-trigger')) {
        permissionPopup.hide()
      }
    })
  },
  show: function (tabId, anchor) {
    if (permissionPopup.isShown) {
      permissionPopup.hide()
      return
    }

    const tab = tabs.get(tabId)
    if (!tab) return

    const url = tab.url
    if (!url || url.startsWith('min://') || url.startsWith('file://')) return

    let hostname
    try {
      hostname = urlParser.getDomain(url)
    } catch (e) {
      return
    }

    // Fetch permissions from main process
    let permissions = {}
    try {
      permissions = ipc.sendSync('getPermissions', hostname)
    } catch (e) {
      console.error(e)
    }

    // Build UI
    permissionPopup.container.innerHTML = ''

    const title = document.createElement('div')
    title.className = 'permission-popup-title'
    title.textContent = l('sitePermissions') + ' - ' + hostname
    permissionPopup.container.appendChild(title)

    const list = document.createElement('div')
    list.className = 'permission-list'

    // Permissions to show
    const permissionTypes = [
      { key: 'notifications', label: l('notifications') },
      { key: 'camera', label: l('camera') },
      { key: 'microphone', label: l('microphone') }
    ]

    permissionTypes.forEach(p => {
      const row = document.createElement('div')
      row.className = 'permission-row'

      const label = document.createElement('span')
      label.textContent = p.label || p.key
      row.appendChild(label)

      const select = document.createElement('select')
      const options = [
        { value: 'prompt', label: l('permissionAsk') },
        { value: 'allow', label: l('permissionAllow') },
        { value: 'block', label: l('permissionBlock') }
      ]

      options.forEach(opt => {
        const option = document.createElement('option')
        option.value = opt.value
        option.textContent = opt.label
        if (permissions[p.key] === true && opt.value === 'allow') option.selected = true
        else if (permissions[p.key] === false && opt.value === 'block') option.selected = true
        else if (permissions[p.key] === undefined && opt.value === 'prompt') option.selected = true
        select.appendChild(option)
      })

      select.addEventListener('change', function () {
        let val = null // default/ask
        if (this.value === 'allow') val = true
        if (this.value === 'block') val = false

        ipc.send('updatePermission', {
          origin: hostname,
          permission: p.key,
          value: val
        })
      })

      row.appendChild(select)
      list.appendChild(row)
    })

    permissionPopup.container.appendChild(list)

    // Position
    const rect = anchor.getBoundingClientRect()
    permissionPopup.container.style.top = (rect.bottom + 10) + 'px'
    permissionPopup.container.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - 260)) + 'px'

    permissionPopup.container.hidden = false
    permissionPopup.isShown = true
  },
  hide: function () {
    permissionPopup.container.hidden = true
    permissionPopup.isShown = false
  }
}

module.exports = permissionPopup
