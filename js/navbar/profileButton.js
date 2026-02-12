const settings = require('util/settings/settings.js')

const profileButton = {
  initialize: function () {
    const button = document.getElementById('profile-button')
    if (!button) return

    function updateIcon() {
      const avatar = settings.get('userAvatar')
      if (avatar) {
        if (avatar.length > 2) { // URL or long text?
             // Simple heuristic, assume it's not an emoji if long
             // For now we only support emoji cycling in this simple implementation
             // But if user set it manually in settings file, we display it.
             button.className = 'navbar-action-button profile-text'
             button.innerText = avatar
             button.classList.remove('i', 'carbon:user-avatar')
        } else {
             button.className = 'navbar-action-button profile-text'
             button.innerText = avatar
             button.classList.remove('i', 'carbon:user-avatar')
        }
      } else {
        button.className = 'navbar-action-button i carbon:user-avatar'
        button.innerText = ''
      }
    }

    settings.listen('userAvatar', updateIcon)
    updateIcon()

    button.addEventListener('click', function (e) {
      // Cycle through some avatars
      const avatars = [null, '👤', '🐱', '🚀', '🎮', '🎓', '💻', '🦊', '⚡️']
      const current = settings.get('userAvatar')
      let idx = avatars.indexOf(current)
      // If not found (or null), start at 0 (which is null, so go to 1)
      if (idx === -1) idx = 0

      idx = (idx + 1) % avatars.length
      settings.set('userAvatar', avatars[idx])
    })

    // Right click to clear
    button.addEventListener('auxclick', function(e) {
        if (e.which === 3 || e.which === 2) {
            settings.set('userAvatar', null)
        }
    })

    button.title = l('profileButtonTooltip')
  }
}

module.exports = profileButton
