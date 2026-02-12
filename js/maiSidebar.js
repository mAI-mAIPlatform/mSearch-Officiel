const maiSidebar = {
  initialize: function () {
    const sidebar = document.getElementById('mai-sidebar')
    const button = document.getElementById('mai-button')
    const iframe = document.getElementById('mai-iframe')

    if (!sidebar || !button || !iframe) {
      console.warn('mAI sidebar elements not found')
      return
    }

    button.addEventListener('click', function () {
      const isHidden = sidebar.hidden

      if (isHidden) {
        // Open sidebar
        sidebar.hidden = false
        button.classList.add('active')

        // Lazy load iframe content
        if (iframe.getAttribute('src') === 'about:blank') {
          iframe.src = 'https://m-ai-officiel.base44.app'
        }
      } else {
        // Close sidebar
        sidebar.hidden = true
        button.classList.remove('active')
      }
    })
  }
}

module.exports = maiSidebar
