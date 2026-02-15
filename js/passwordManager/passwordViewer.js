const fs = require('fs')
const crypto = require('crypto')
const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')
const PasswordManagers = require('passwordManager/passwordManager.js')
const modalMode = require('modalMode.js')
const { ipcRenderer } = require('electron')
const papaparse = require('papaparse')

const PASSWORD_PIN_KEY = 'passwordViewer.pinHash'
const PASSWORD_ADDRESSES_KEY = 'passwordViewer.addresses'
const PASSWORD_CARDS_KEY = 'passwordViewer.cards'

const passwordViewer = {
  container: document.getElementById('password-viewer'),
  listContainer: document.getElementById('password-viewer-list'),
  emptyHeading: document.getElementById('password-viewer-empty'),
  closeButton: document.querySelector('#password-viewer .modal-close-button'),
  exportButton: document.getElementById('password-viewer-export'),
  importButton: document.getElementById('password-viewer-import'),
  addressList: document.getElementById('password-address-list'),
  cardList: document.getElementById('password-card-list'),
  addAddressButton: document.getElementById('password-address-add'),
  addCardButton: document.getElementById('password-card-add'),
  createCredentialListElement: function (credential) {
    var container = document.createElement('div')

    var domainEl = document.createElement('span')
    domainEl.className = 'domain-name'
    domainEl.textContent = credential.domain
    container.appendChild(domainEl)

    var usernameEl = document.createElement('input')
    usernameEl.value = credential.username
    usernameEl.disabled = true
    container.appendChild(usernameEl)

    var passwordEl = document.createElement('input')
    passwordEl.type = 'password'
    passwordEl.value = credential.password
    passwordEl.disabled = true
    container.appendChild(passwordEl)

    var revealButton = document.createElement('button')
    revealButton.className = 'i carbon:view'
    revealButton.addEventListener('click', function () {
      if (passwordEl.type === 'password') {
        passwordEl.type = 'text'
        revealButton.classList.remove('carbon:view')
        revealButton.classList.add('carbon:view-off')
      } else {
        passwordEl.type = 'password'
        revealButton.classList.add('carbon:view')
        revealButton.classList.remove('carbon:view-off')
      }
    })
    container.appendChild(revealButton)

    var deleteButton = document.createElement('button')
    deleteButton.className = 'i carbon:trash-can'
    container.appendChild(deleteButton)

    deleteButton.addEventListener('click', function () {
      if (confirm(l('deletePassword').replace('%s', credential.domain))) {
        PasswordManagers.getConfiguredPasswordManager().then(function (manager) {
          manager.deleteCredential(credential.domain, credential.username)
          container.remove()
          passwordViewer._updatePasswordListFooter()
        })
      }
    })

    return container
  },
  createNeverSaveDomainElement: function (domain) {
    var container = document.createElement('div')

    var domainEl = document.createElement('span')
    domainEl.className = 'domain-name'
    domainEl.textContent = domain
    container.appendChild(domainEl)

    var descriptionEl = document.createElement('span')
    descriptionEl.className = 'description'
    descriptionEl.textContent = l('savedPasswordsNeverSavedLabel')
    container.appendChild(descriptionEl)

    var deleteButton = document.createElement('button')
    deleteButton.className = 'i carbon:trash-can'
    container.appendChild(deleteButton)

    deleteButton.addEventListener('click', function () {
      settings.set('passwordsNeverSaveDomains', settings.get('passwordsNeverSaveDomains').filter(d => d !== domain))
      container.remove()
      passwordViewer._updatePasswordListFooter()
    })

    return container
  },

  hashPin: function (pin) {
    return crypto.createHash('sha256').update(String(pin)).digest('hex')
  },
  ensurePinAccess: function () {
    const existingPinHash = localStorage.getItem(PASSWORD_PIN_KEY)

    if (!existingPinHash) {
      const firstPin = ipcRenderer.sendSync('prompt', {
        text: 'Créez un code PIN pour sécuriser vos mots de passe (4 à 8 chiffres).',
        values: [{ placeholder: 'Code PIN', id: 'pin', type: 'password' }],
        ok: l('dialogConfirmButton'),
        cancel: l('dialogCancelButton'),
        height: 190
      })

      const pin = firstPin && firstPin.pin ? String(firstPin.pin).trim() : ''
      if (!/^\d{4,8}$/.test(pin)) {
        return false
      }

      const confirmPin = ipcRenderer.sendSync('prompt', {
        text: 'Confirmez le code PIN.',
        values: [{ placeholder: 'Confirmer le code PIN', id: 'pinConfirm', type: 'password' }],
        ok: l('dialogConfirmButton'),
        cancel: l('dialogCancelButton'),
        height: 190
      })

      if (!confirmPin || String(confirmPin.pinConfirm).trim() !== pin) {
        return false
      }

      localStorage.setItem(PASSWORD_PIN_KEY, passwordViewer.hashPin(pin))
      return true
    }

    const provided = ipcRenderer.sendSync('prompt', {
      text: 'Entrez votre code PIN pour afficher les données sensibles.',
      values: [{ placeholder: 'Code PIN', id: 'pin', type: 'password' }],
      ok: l('dialogConfirmButton'),
      cancel: l('dialogCancelButton'),
      height: 190
    })

    if (!provided || !provided.pin) {
      return false
    }

    return passwordViewer.hashPin(String(provided.pin).trim()) === existingPinHash
  },
  getSecureItems: function (key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(data) ? data : []
    } catch (e) {
      return []
    }
  },
  setSecureItems: function (key, items) {
    localStorage.setItem(key, JSON.stringify(items))
  },
  renderAddresses: function () {
    if (!passwordViewer.addressList) {
      return
    }
    empty(passwordViewer.addressList)
    const addresses = passwordViewer.getSecureItems(PASSWORD_ADDRESSES_KEY)
    if (addresses.length === 0) {
      const el = document.createElement('div')
      el.className = 'description'
      el.textContent = 'Aucune adresse enregistrée.'
      passwordViewer.addressList.appendChild(el)
      return
    }

    addresses.forEach(function (address, index) {
      const row = document.createElement('div')
      const label = document.createElement('span')
      label.className = 'domain-name'
      label.textContent = address.fullName || 'Adresse'
      const value = document.createElement('span')
      value.className = 'description'
      value.textContent = [address.line1, address.city, address.country].filter(Boolean).join(', ')
      const remove = document.createElement('button')
      remove.className = 'i carbon:trash-can'
      remove.addEventListener('click', function () {
        const next = passwordViewer.getSecureItems(PASSWORD_ADDRESSES_KEY)
        next.splice(index, 1)
        passwordViewer.setSecureItems(PASSWORD_ADDRESSES_KEY, next)
        passwordViewer.renderAddresses()
      })
      row.appendChild(label)
      row.appendChild(value)
      row.appendChild(remove)
      passwordViewer.addressList.appendChild(row)
    })
  },
  renderCards: function () {
    if (!passwordViewer.cardList) {
      return
    }
    empty(passwordViewer.cardList)
    const cards = passwordViewer.getSecureItems(PASSWORD_CARDS_KEY)
    if (cards.length === 0) {
      const el = document.createElement('div')
      el.className = 'description'
      el.textContent = 'Aucune carte bancaire enregistrée.'
      passwordViewer.cardList.appendChild(el)
      return
    }

    cards.forEach(function (card, index) {
      const row = document.createElement('div')
      const label = document.createElement('span')
      label.className = 'domain-name'
      label.textContent = card.cardholder || 'Carte'
      const value = document.createElement('span')
      value.className = 'description'
      value.textContent = `**** **** **** ${String(card.number || '').slice(-4)} • ${card.expiry || ''}`
      const remove = document.createElement('button')
      remove.className = 'i carbon:trash-can'
      remove.addEventListener('click', function () {
        const next = passwordViewer.getSecureItems(PASSWORD_CARDS_KEY)
        next.splice(index, 1)
        passwordViewer.setSecureItems(PASSWORD_CARDS_KEY, next)
        passwordViewer.renderCards()
      })
      row.appendChild(label)
      row.appendChild(value)
      row.appendChild(remove)
      passwordViewer.cardList.appendChild(row)
    })
  },

  _renderPasswordList: function (credentials) {
    empty(passwordViewer.listContainer)

    credentials.forEach(function (cred) {
      passwordViewer.listContainer.appendChild(passwordViewer.createCredentialListElement(cred))
    })

    const neverSaveDomains = settings.get('passwordsNeverSaveDomains') || []

    neverSaveDomains.forEach(function (domain) {
      passwordViewer.listContainer.appendChild(passwordViewer.createNeverSaveDomainElement(domain))
    })

    passwordViewer._updatePasswordListFooter()
  },
  _updatePasswordListFooter: function () {
    const hasCredentials = (passwordViewer.listContainer.children.length !== 0)
    passwordViewer.emptyHeading.hidden = hasCredentials
    passwordViewer.exportButton.hidden = !hasCredentials
  },
  show: function () {
    if (!passwordViewer.ensurePinAccess()) {
      return
    }

    PasswordManagers.getConfiguredPasswordManager().then(function (manager) {
      if (!manager.getAllCredentials) {
        throw new Error('unsupported password manager')
      }

      manager.getAllCredentials().then(function (credentials) {
        webviews.requestPlaceholder('passwordViewer')
        modalMode.toggle(true, {
          onDismiss: passwordViewer.hide
        })
        passwordViewer.container.hidden = false

        passwordViewer._renderPasswordList(credentials)
        passwordViewer.renderAddresses()
        passwordViewer.renderCards()
      })
    })
  },
  importCredentials: async function () {
    PasswordManagers.getConfiguredPasswordManager().then(async function (manager) {
      if (!manager.importCredentials || !manager.getAllCredentials) {
        throw new Error('unsupported password manager')
      }

      const credentials = await manager.getAllCredentials()
      const shouldShowConsent = credentials.length > 0

      if (shouldShowConsent) {
        const securityConsent = ipcRenderer.sendSync('prompt', {
          text: l('importCredentialsConfirmation'),
          ok: l('dialogConfirmButton'),
          cancel: l('dialogCancelButton'),
          width: 400,
          height: 200
        })
        if (!securityConsent) return
      }

      const filePaths = await ipcRenderer.invoke('showOpenDialog', {
        filters: [
          { name: 'CSV', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!filePaths || !filePaths[0]) return

      const fileContents = fs.readFileSync(filePaths[0], 'utf8')

      manager.importCredentials(fileContents).then(function (credentials) {
        if (credentials.length === 0) return
        passwordViewer._renderPasswordList(credentials)
        passwordViewer.renderAddresses()
        passwordViewer.renderCards()
      })
    })
  },
  exportCredentials: function () {
    PasswordManagers.getConfiguredPasswordManager().then(function (manager) {
      if (!manager.getAllCredentials) {
        throw new Error('unsupported password manager')
      }

      const securityConsent = ipcRenderer.sendSync('prompt', {
        text: l('exportCredentialsConfirmation'),
        ok: l('dialogConfirmButton'),
        cancel: l('dialogCancelButton'),
        width: 400,
        height: 200
      })
      if (!securityConsent) return

      manager.getAllCredentials().then(function (credentials) {
        if (credentials.length === 0) return

        const csvData = papaparse.unparse({
          fields: ['url', 'username', 'password'],
          data: credentials.map(credential => [
            `https://${credential.domain}`,
            credential.username,
            credential.password
          ])
        })
        const blob = new Blob([csvData], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = 'credentials.csv'
        anchor.click()
        URL.revokeObjectURL(url)
      })
    })
  },
  hide: function () {
    webviews.hidePlaceholder('passwordViewer')
    modalMode.toggle(false)
    passwordViewer.container.hidden = true
  },
  initialize: function () {
    passwordViewer.exportButton.addEventListener('click', passwordViewer.exportCredentials)
    passwordViewer.importButton.addEventListener('click', passwordViewer.importCredentials)
    passwordViewer.closeButton.addEventListener('click', passwordViewer.hide)

    if (passwordViewer.addAddressButton) {
      passwordViewer.addAddressButton.addEventListener('click', function () {
        const fullName = window.prompt('Nom complet')
        if (!fullName) return
        const line1 = window.prompt('Adresse (ligne 1)')
        if (!line1) return
        const city = window.prompt('Ville') || ''
        const country = window.prompt('Pays') || ''
        const list = passwordViewer.getSecureItems(PASSWORD_ADDRESSES_KEY)
        list.unshift({ fullName: fullName.trim(), line1: line1.trim(), city: city.trim(), country: country.trim() })
        passwordViewer.setSecureItems(PASSWORD_ADDRESSES_KEY, list)
        passwordViewer.renderAddresses()
      })
    }

    if (passwordViewer.addCardButton) {
      passwordViewer.addCardButton.addEventListener('click', function () {
        const cardholder = window.prompt('Nom du titulaire')
        if (!cardholder) return
        const number = (window.prompt('Numéro de carte') || '').replace(/\s+/g, '')
        if (!/^\d{12,19}$/.test(number)) return
        const expiry = window.prompt("Date d'expiration (MM/AA)") || ''
        const list = passwordViewer.getSecureItems(PASSWORD_CARDS_KEY)
        list.unshift({ cardholder: cardholder.trim(), number, expiry: expiry.trim() })
        passwordViewer.setSecureItems(PASSWORD_CARDS_KEY, list)
        passwordViewer.renderCards()
      })
    }
    webviews.bindIPC('showCredentialList', function () {
      passwordViewer.show()
    })
  }
}

module.exports = passwordViewer
