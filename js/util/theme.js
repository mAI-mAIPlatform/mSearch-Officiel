if (typeof require !== 'undefined') {
  var settings = require('util/settings/settings.js')
}

function enableDarkMode () {
  document.body.classList.add('dark-mode')
  window.isDarkMode = true
  requestAnimationFrame(function () {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

function disableDarkMode () {
  document.body.classList.remove('dark-mode')
  window.isDarkMode = false
  requestAnimationFrame(function () {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

function clamp (value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function applyTypographyPreferences () {
  const fontScale = settings.get('uiFontScale') || 100
  const letterSpacing = settings.get('uiLetterSpacing') || 0
  const comfortReading = settings.get('comfortReadingMode') === true

  document.documentElement.style.setProperty('--ui-font-scale', String(fontScale / 100))
  document.documentElement.style.setProperty('--ui-letter-spacing', `${letterSpacing}px`)
  document.body.classList.toggle('comfort-reading', comfortReading)
}

function applyLiquidGlassPreference () {
  const enabled = settings.get('liquidGlassAnimations') !== false
  document.body.classList.toggle('liquid-glass-animations', enabled)
}

function applyLiquidGlassTokens () {
  const blurSetting = Number(settings.get('liquidGlassBlur'))
  const opacitySetting = Number(settings.get('liquidGlassOpacity'))
  const blur = Number.isFinite(blurSetting) ? clamp(blurSetting, 8, 28) : 16
  const opacity = Number.isFinite(opacitySetting) ? clamp(opacitySetting, 0.3, 0.8) : 0.58

  document.documentElement.style.setProperty('--liquid-glass-blur', `${blur}px`)
  document.documentElement.style.setProperty('--liquid-glass-opacity', opacity.toFixed(2))
}

function getLocalHour () {
  return new Date().getHours()
}

function applyDynamicTheme () {
  const enabled = settings.get('dynamicThemeEnabled') === true
  document.body.classList.toggle('dynamic-theme-enabled', enabled)

  if (!enabled) {
    document.body.classList.remove('dynamic-theme-morning', 'dynamic-theme-day', 'dynamic-theme-evening', 'dynamic-theme-night')
    return
  }

  const hour = getLocalHour()
  const periodClass = hour < 7 ? 'dynamic-theme-night'
    : hour < 11 ? 'dynamic-theme-morning'
      : hour < 18 ? 'dynamic-theme-day'
        : hour < 22 ? 'dynamic-theme-evening'
          : 'dynamic-theme-night'

  document.body.classList.remove('dynamic-theme-morning', 'dynamic-theme-day', 'dynamic-theme-evening', 'dynamic-theme-night')
  document.body.classList.add(periodClass)
}

function initialize () {
  function themeChanged (value) {
    if (value === true) {
      enableDarkMode()
    } else {
      disableDarkMode()
    }
  }

  settings.listen('darkThemeIsActive', themeChanged)

  settings.listen('uiFontScale', applyTypographyPreferences)
  settings.listen('uiLetterSpacing', applyTypographyPreferences)
  settings.listen('comfortReadingMode', applyTypographyPreferences)
  settings.listen('liquidGlassAnimations', applyLiquidGlassPreference)
  settings.listen('dynamicThemeEnabled', applyDynamicTheme)
  settings.listen('liquidGlassBlur', applyLiquidGlassTokens)
  settings.listen('liquidGlassOpacity', applyLiquidGlassTokens)

  applyTypographyPreferences()
  applyLiquidGlassPreference()
  applyLiquidGlassTokens()
  applyDynamicTheme()

  setInterval(applyDynamicTheme, 5 * 60 * 1000)
}

if (typeof module !== 'undefined') {
  module.exports = { initialize }
} else {
  initialize()
}
