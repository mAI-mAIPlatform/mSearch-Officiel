const { ipcRenderer } = require('electron')
const fs = require('fs')

const settings = require('util/settings/settings.js')
const webviews = require('webviews.js')
const keybindings = require('keybindings.js')
const statistics = require('js/statistics.js')

const Bitwarden = require('js/passwordManager/bitwarden.js')
const OnePassword = require('js/passwordManager/onePassword.js')
const Keychain = require('js/passwordManager/keychain.js')

const PasswordManagers = {
  // List of supported password managers. Each password manager is expected to
  // have getSuggestions(domain) method that returns a Promise with credentials
  // suggestions matching given domain name.
  managers: [
    new Bitwarden(),
    new OnePassword(),
    new Keychain()
  ],
  // PIN & Data Helpers
  async hashPin (pin) {
    const msgBuffer = new TextEncoder().encode(pin)
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  },
  async setPin (pin) {
    const hash = await this.hashPin(pin)
    localStorage.setItem('msearch.security.pinHash', hash)
  },
  async verifyPin (pin) {
    const stored = localStorage.getItem('msearch.security.pinHash')
    if (!stored) return true
    const hash = await this.hashPin(pin)
    return hash === stored
  },
  hasPin () {
    return !!localStorage.getItem('msearch.security.pinHash')
  },
  // Address & Card Helpers
  getAddresses () {
    try {
      return JSON.parse(localStorage.getItem('msearch.autofill.addresses') || '[]')
    } catch (e) { return [] }
  },
  saveAddress (address) {
    const list = this.getAddresses()
    address.id = address.id || Date.now().toString()
    const idx = list.findIndex(i => i.id === address.id)
    if (idx !== -1) list[idx] = address
    else list.push(address)
    localStorage.setItem('msearch.autofill.addresses', JSON.stringify(list))
  },
  deleteAddress (id) {
    const list = this.getAddresses().filter(i => i.id !== id)
    localStorage.setItem('msearch.autofill.addresses', JSON.stringify(list))
  },
  getCards () {
    try {
      return JSON.parse(localStorage.getItem('msearch.autofill.cards') || '[]')
    } catch (e) { return [] }
  },
  saveCard (card) {
    // Basic Luhn check could be done in UI before calling this, or here.
    const list = this.getCards()
    card.id = card.id || Date.now().toString()
    const idx = list.findIndex(i => i.id === card.id)
    if (idx !== -1) list[idx] = card
    else list.push(card)
    localStorage.setItem('msearch.autofill.cards', JSON.stringify(list))
  },
  deleteCard (id) {
    const list = this.getCards().filter(i => i.id !== id)
    localStorage.setItem('msearch.autofill.cards', JSON.stringify(list))
  },
  // Returns an active password manager, which is the one that is selected in app's
  // settings.
  getActivePasswordManager: function () {
    if (PasswordManagers.managers.length === 0) {
      return null
    }

    const managerSetting = settings.get('passwordManager')
    if (managerSetting == null) {
      return PasswordManagers.managers.find(mgr => mgr.name === 'Built-in password manager')
    }

    return PasswordManagers.managers.find(mgr => mgr.name === managerSetting.name)
  },
  getConfiguredPasswordManager: async function () {
    const manager = PasswordManagers.getActivePasswordManager()
    if (!manager) {
      return null
    }

    const configured = await manager.checkIfConfigured()
    if (!configured) {
      return null
    }

    return manager
  },
  // Shows a prompt dialog for password store's master password.
  promptForMasterPassword: async function (manager) {
    return new Promise((resolve, reject) => {
      const { password } = ipcRenderer.sendSync('prompt', {
        text: l('passwordManagerUnlock').replace('%p', manager.name),
        values: [{ placeholder: l('password'), id: 'password', type: 'password' }],
        ok: l('dialogConfirmButton'),
        cancel: l('dialogSkipButton'),
        height: 175
      })
      if (password === null || password === '') {
        reject(new Error('No password provided'))
      } else {
        resolve(password)
      }
    })
  },
  unlock: async function (manager) {
    let success = false
    while (!success) {
      let password
      try {
        password = await PasswordManagers.promptForMasterPassword(manager)
      } catch (e) {
        // dialog was canceled
        break
      }
      try {
        success = await manager.unlockStore(password)
      } catch (e) {
        // incorrect password, prompt again
      }
    }
    return success
  },
  // Binds IPC events.
  initialize: function () {
    // Called when page preload script detects a form with username and password.
    webviews.bindIPC('password-autofill', function (tab, args, frameId, frameURL) {
      // it's important to use frameURL here and not the tab URL, because the domain of the
      // requesting iframe may not match the domain of the top-level page
      const hostname = new URL(frameURL).hostname

      PasswordManagers.getConfiguredPasswordManager().then(async (manager) => {
        if (!manager) {
          return
        }

        if (!manager.isUnlocked()) {
          await PasswordManagers.unlock(manager)
        }

        var formattedHostname = hostname
        if (formattedHostname.startsWith('www.')) {
          formattedHostname = formattedHostname.slice(4)
        }

        manager.getSuggestions(formattedHostname).then(credentials => {
          if (credentials != null) {
            webviews.callAsync(tab, 'sendToFrame', [frameId, 'password-autofill-match', {
              credentials,
              hostname
            }])
          }
        }).catch(e => {
          console.error('Failed to get password suggestions: ' + e.message)
        })
      })
    })

    webviews.bindIPC('password-autofill-check', function (tab, args, frameId) {
      if (PasswordManagers.getActivePasswordManager()) {
        webviews.callAsync(tab, 'sendToFrame', [frameId, 'password-autofill-enabled'])
      }
    })

    keybindings.defineShortcut('fillPassword', function () {
      webviews.callAsync(tabs.getSelected(), 'send', ['password-autofill-shortcut'])
    })

    statistics.registerGetter('passwordManager', function () {
      return PasswordManagers.getActivePasswordManager().name
    })
  }
}

module.exports = PasswordManagers
