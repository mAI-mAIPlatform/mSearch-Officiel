var pendingPermissions = []
var grantedPermissions = []
var nextPermissionId = 1

var savedPermissions = {}
const permissionsPath = path.join(app.getPath('userData'), 'permissions.json')

try {
  if (fs.existsSync(permissionsPath)) {
    var data = fs.readFileSync(permissionsPath, 'utf-8')
    savedPermissions = JSON.parse(data)
  }
} catch (e) {
  console.error(e)
}

function savePermissions () {
  try {
    fs.writeFileSync(permissionsPath, JSON.stringify(savedPermissions), 'utf-8')
  } catch (e) {
    console.error(e)
  }
}

/*
All permission requests are given to the renderer on each change,
it will figure out what updates to make
*/
function sendPermissionsToRenderers () {
  // send all requests to all windows - the tab bar in each will figure out what to display
  windows.getAll().forEach(function (win) {
    sendIPCToWindow(win, 'updatePermissions', pendingPermissions.concat(grantedPermissions).map(p => {
      // remove properties that can't be serialized over IPC
      return {
        permissionId: p.permissionId,
        tabId: p.tabId,
        origin: p.origin,
        permission: p.permission,
        details: p.details,
        granted: p.granted
      }
    }))
  })
}

function removePermissionsForContents (contents) {
  pendingPermissions = pendingPermissions.filter(perm => perm.contents !== contents)
  grantedPermissions = grantedPermissions.filter(perm => perm.contents !== contents)

  sendPermissionsToRenderers()
}

/*
Was permission already granted for this origin?
*/
function isPermissionGrantedForOrigin (requestOrigin, requestPermission, requestDetails) {
  // Check saved permissions
  if (savedPermissions[requestOrigin]) {
    const saved = savedPermissions[requestOrigin]
    if (requestPermission === 'notifications' && saved.notifications === true) {
      return true
    }

    if (requestPermission === 'media') {
      let allowed = true
      let blocked = false

      if (requestDetails.mediaTypes) {
        if (requestDetails.mediaTypes.includes('video')) {
          if (saved.camera === true) {
            // ok
          } else if (saved.camera === false) {
            blocked = true
          } else {
            allowed = false // not set
          }
        }
        if (requestDetails.mediaTypes.includes('audio')) {
          if (saved.microphone === true) {
            // ok
          } else if (saved.microphone === false) {
            blocked = true
          } else {
            allowed = false // not set
          }
        }
      }

      if (blocked) return false
      if (allowed && requestDetails.mediaTypes) return true
    }
  }

  for (var i = 0; i < grantedPermissions.length; i++) {
    if (requestOrigin === grantedPermissions[i].origin) {
      if (requestPermission === 'notifications' && grantedPermissions[i].permission === 'notifications') {
        return true
      }

      if (requestPermission === 'pointerLock' && grantedPermissions[i].permission === 'pointerLock') {
        return true
      }

      if (requestPermission === 'media' && grantedPermissions[i].permission === 'media') {
        // type 1: from permissionCheckHandler
        // request has a single media type
        if (requestDetails.mediaType && grantedPermissions[i].details.mediaTypes.includes(requestDetails.mediaType)) {
          return true
        }
        // type 2: from a permissionRequestHandler
        // request has multiple media types
        // TODO existing granted permissions should be merged together (i.e. if there is an existing permission for audio, and another for video, a new request for audio+video should be approved, but it currently won't be)
        if (requestDetails.mediaTypes && requestDetails.mediaTypes.every(type => grantedPermissions[i].details.mediaTypes.includes(type))) {
          return true
        }

        // type 3: a general media permission with no specific type
        // occurs immediately after granting a more specific permission type
        if (!requestDetails.mediaType && !requestDetails.mediaTypes && grantedPermissions[i].permission === 'media') {
          return true
        }
      }
    }
  }
  return false
}

function isPermissionBlockedForOrigin (requestOrigin, requestPermission, requestDetails) {
  if (savedPermissions[requestOrigin]) {
    const saved = savedPermissions[requestOrigin]
    if (requestPermission === 'notifications' && saved.notifications === false) {
      return true
    }
    if (requestPermission === 'media') {
      if (requestDetails.mediaTypes) {
        if (requestDetails.mediaTypes.includes('video') && saved.camera === false) return true
        if (requestDetails.mediaTypes.includes('audio') && saved.microphone === false) return true
      }
    }
  }
  return false
}

/*
Is there already a pending request of the given type for this origin?
 */
function hasPendingRequestForOrigin (requestOrigin, permission, details) {
  for (var i = 0; i < pendingPermissions.length; i++) {
    if (requestOrigin === pendingPermissions[i].origin && permission === pendingPermissions[i].permission) {
      return true
    }
  }
  return false
}

function pagePermissionRequestHandler (webContents, permission, callback, details) {
  if (permission === 'fullscreen') {
    callback(true)
    return
  }

  if (!details.isMainFrame) {
    // not supported for now to simplify the UI
    callback(false)
    return
  }

  if (!details.requestingUrl) {
    callback(false)
    return
  }

  if (permission === 'clipboard-sanitized-write') {
    callback(true)
    return
  }

  let requestOrigin
  try {
    requestOrigin = new URL(details.requestingUrl).hostname
  } catch (e) {
    // invalid URL
    console.warn(e, details.requestingUrl)
    callback(false)
    return
  }

  /*
  Geolocation requires a Google API key (https://www.electronjs.org/docs/api/environment-variables#google_api_key), so it is disabled.
  Other permissions aren't supported for now to simplify the UI
  */
  if (['media', 'notifications', 'pointerLock'].includes(permission)) {
    if (isPermissionBlockedForOrigin(requestOrigin, permission, details)) {
      callback(false)
      return
    }

    /*
    If permission was previously granted for this origin in a different tab, new requests should be allowed
    */
    if (isPermissionGrantedForOrigin(requestOrigin, permission, details)) {
      callback(true)

      if (!grantedPermissions.some(grant => grant.contents === webContents && grant.permission === permission)) {
        grantedPermissions.push({
          permissionId: nextPermissionId,
          tabId: getTabIDFromWebContents(webContents),
          contents: webContents,
          origin: requestOrigin,
          permission: permission,
          details: details,
          granted: true
        })

        sendPermissionsToRenderers()
        nextPermissionId++
      }
    } else if (permission === 'notifications' && hasPendingRequestForOrigin(requestOrigin, permission, details)) {
      /*
      Sites sometimes make a new request for each notification, which can generate multiple requests if the first one wasn't approved.
      TODO this isn't entirely correct (some requests will be rejected when they should be pending) - correct solution is to show a single button to approve all requests in the UI.
      */
      callback(false)
    } else {
      pendingPermissions.push({
        permissionId: nextPermissionId,
        tabId: getTabIDFromWebContents(webContents),
        contents: webContents,
        origin: requestOrigin,
        permission: permission,
        details: details,
        callback: callback
      })

      sendPermissionsToRenderers()
      nextPermissionId++
    }

    /*
    Once this view is closed or navigated to a new page, these permissions should be revoked
    */
    webContents.on('did-start-navigation', function (e, url, isInPlace, isMainFrame, frameProcessId, frameRoutingId) {
      if (isMainFrame && !isInPlace) {
        removePermissionsForContents(webContents)
      }
    })
    webContents.once('destroyed', function () {
      // check whether the app is shutting down to avoid an electron crash (TODO remove this)
      if (windows.getAll().length > 0) {
        removePermissionsForContents(webContents)
      }
    })
  } else {
    callback(false)
  }
}

function pagePermissionCheckHandler (webContents, permission, requestingOrigin, details) {
  if (!details.isMainFrame && requestingOrigin !== details.embeddingOrigin) {
    return false
  }

  // TODO sometimes the origin field is blank, figure out why
  if (!requestingOrigin) {
    return false
  }

  if (permission === 'clipboard-sanitized-write') {
    return true
  }

  let requestHostname
  try {
    requestHostname = new URL(requestingOrigin).hostname
  } catch (e) {
    // invalid URL
    console.warn(e, requestingOrigin)
    return false
  }

  if (isPermissionBlockedForOrigin(requestHostname, permission, details)) {
    return false
  }

  return isPermissionGrantedForOrigin(requestHostname, permission, details)
}

app.once('ready', function () {
  session.defaultSession.setPermissionRequestHandler(pagePermissionRequestHandler)
  session.defaultSession.setPermissionCheckHandler(pagePermissionCheckHandler)
})

app.on('session-created', function (session) {
  session.setPermissionRequestHandler(pagePermissionRequestHandler)
  session.setPermissionCheckHandler(pagePermissionCheckHandler)
})

ipc.on('permissionGranted', function (e, permissionId) {
  for (var i = 0; i < pendingPermissions.length; i++) {
    if (permissionId && pendingPermissions[i].permissionId === permissionId) {
      pendingPermissions[i].granted = true
      pendingPermissions[i].callback(true)

      // Save to persistent store
      const p = pendingPermissions[i]
      if (!savedPermissions[p.origin]) savedPermissions[p.origin] = {}

      if (p.permission === 'notifications') {
        savedPermissions[p.origin].notifications = true
      } else if (p.permission === 'media') {
        if (p.details.mediaTypes) {
          if (p.details.mediaTypes.includes('video')) savedPermissions[p.origin].camera = true
          if (p.details.mediaTypes.includes('audio')) savedPermissions[p.origin].microphone = true
        }
      }
      savePermissions()

      grantedPermissions.push(pendingPermissions[i])
      pendingPermissions.splice(i, 1)

      sendPermissionsToRenderers()
      break
    }
  }
})

ipc.on('updatePermission', function (e, data) {
  // data: { origin, permission, value }
  // permission: 'notifications', 'camera', 'microphone'
  // value: true, false, null

  if (!savedPermissions[data.origin]) savedPermissions[data.origin] = {}
  savedPermissions[data.origin][data.permission] = data.value

  savePermissions()
})

ipc.on('getPermissions', function (e, origin) {
  e.returnValue = savedPermissions[origin] || {}
})
