const settings = require('util/settings/settings.js')

const defaultProfileSettings = {
  displayName: '',
  avatarType: 'emoji',
  emoji: '🙂',
  symbol: '◆',
  accentColor: '#6ca0ff'
}

function getInitials (displayName) {
  if (!displayName) {
    return 'MS'
  }
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return 'MS'
  }

  return parts.map(part => part[0].toUpperCase()).join('')
}

function normalizeProfileSettings (value) {
  const current = value || {}
  return {
    displayName: typeof current.displayName === 'string' ? current.displayName.slice(0, 32) : defaultProfileSettings.displayName,
    avatarType: ['emoji', 'initials', 'symbol'].includes(current.avatarType) ? current.avatarType : defaultProfileSettings.avatarType,
    emoji: typeof current.emoji === 'string' && current.emoji.trim() ? current.emoji : defaultProfileSettings.emoji,
    symbol: typeof current.symbol === 'string' && current.symbol.trim() ? current.symbol.trim().slice(0, 2) : defaultProfileSettings.symbol,
    accentColor: /^#[0-9a-fA-F]{6}$/.test(current.accentColor) ? current.accentColor : defaultProfileSettings.accentColor
  }
}

const profileButton = {
  button: document.getElementById('profile-button'),
  avatars: ['🙂', '😎', '🧠', '🚀', '🐱', '🦊', '🐼', '🦉', '🐙', '🌟'],
  initialize: function () {
    if (!profileButton.button) {
      return
    }

    // Migration douce de l'ancien format (profileAvatar) vers profileSettings.
    const legacyAvatar = settings.get('profileAvatar')
    if (legacyAvatar && !settings.get('profileSettings')) {
      settings.set('profileSettings', {
        ...defaultProfileSettings,
        emoji: legacyAvatar
      })
    }

    settings.listen('profileSettings', function (value) {
      profileButton.render(normalizeProfileSettings(value))
    })

    profileButton.button.addEventListener('click', function (e) {
      e.stopPropagation()
      const profileSettings = normalizeProfileSettings(settings.get('profileSettings'))

      // Raccourci UX : clic rapide = avatar suivant seulement en mode emoji.
      if (profileSettings.avatarType === 'emoji') {
        const current = profileSettings.emoji
        const index = profileButton.avatars.indexOf(current)
        const nextIndex = index === -1 ? 0 : (index + 1) % profileButton.avatars.length
        settings.set('profileSettings', {
          ...profileSettings,
          emoji: profileButton.avatars[nextIndex]
        })
      }
    })
  },
  render: function (profileSettings) {
    let avatarContent = profileSettings.emoji

    if (profileSettings.avatarType === 'initials') {
      avatarContent = getInitials(profileSettings.displayName)
    } else if (profileSettings.avatarType === 'symbol') {
      avatarContent = profileSettings.symbol
    }

    profileButton.button.textContent = avatarContent
    profileButton.button.style.setProperty('--profile-accent-color', profileSettings.accentColor)

    const label = profileSettings.displayName || l('profileButtonLabel')
    const title = label + ' • ' + avatarContent
    profileButton.button.title = title
    profileButton.button.setAttribute('aria-label', title)
  }
}

module.exports = profileButton
