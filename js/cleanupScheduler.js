const settings = require('util/settings/settings.js')

const cleanupScheduler = {
  timer: null,
  runCleanup: function () {
    const options = settings.get('cleanupDataOptions') || { cookies: true, history: true, cache: true }
    ipc.invoke('clearBrowsingData', options)
  },
  applySchedule: function (schedule) {
    if (cleanupScheduler.timer) {
      clearInterval(cleanupScheduler.timer)
      cleanupScheduler.timer = null
    }

    if (schedule === '24h') {
      cleanupScheduler.timer = setInterval(cleanupScheduler.runCleanup, 24 * 60 * 60 * 1000)
    }
  },
  initialize: function () {
    const schedule = settings.get('cleanupSchedule') || 'off'
    cleanupScheduler.applySchedule(schedule)

    if (schedule === 'startup') {
      cleanupScheduler.runCleanup()
    }

    settings.listen('cleanupSchedule', function (value) {
      const nextSchedule = value || 'off'
      cleanupScheduler.applySchedule(nextSchedule)
      // Si l'utilisateur active "au démarrage" à chaud, on exécute un nettoyage immédiat une fois.
      if (nextSchedule === 'startup') {
        cleanupScheduler.runCleanup()
      }
    })
  }
}

module.exports = cleanupScheduler
