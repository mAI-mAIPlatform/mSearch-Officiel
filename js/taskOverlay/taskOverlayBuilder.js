const browserUI = require('browserUI.js')
const searchbarUtils = require('searchbar/searchbarUtils.js')
const urlParser = require('util/urlParser.js')
const searchEngine = require('util/searchEngine.js')

const faviconMinimumLuminance = 70 // minimum brightness for a "light" favicon

function getTaskRelativeDate (task) {
  let minimumTime = new Date()
  minimumTime.setHours(0)
  minimumTime.setMinutes(0)
  minimumTime.setSeconds(0)
  minimumTime = minimumTime.getTime()
  minimumTime -= (5 * 24 * 60 * 60 * 1000)

  const time = tasks.getLastActivity(task.id)
  const d = new Date(time)

  // don't show times for recent tasks in order to save space
  if (time > minimumTime) {
    return null
  } else {
    return new Intl.DateTimeFormat(navigator.language, { month: 'long', day: 'numeric', year: 'numeric' }).format(d)
  }
}

function toggleCollapsed (taskContainer, task) {
  tasks.update(task.id, { collapsed: !tasks.isCollapsed(task.id) })
  taskContainer.classList.toggle('collapsed')

  const collapseButton = taskContainer.querySelector('.task-collapse-button')
  collapseButton.classList.toggle('carbon:chevron-right')
  collapseButton.classList.toggle('carbon:chevron-down')

  if (tasks.isCollapsed(task.id)) {
    collapseButton.setAttribute('aria-expanded', 'false')
  } else {
    collapseButton.setAttribute('aria-expanded', 'true')
  }
}

var TaskOverlayBuilder = {
  create: {
    task: {
      collapseButton: function (taskContainer, task) {
        const collapseButton = document.createElement('button')
        collapseButton.className = 'task-collapse-button i'
        collapseButton.setAttribute('tabindex', '-1')

        collapseButton.setAttribute('aria-haspopup', 'true')
        if (tasks.isCollapsed(task.id)) {
          collapseButton.classList.add('carbon:chevron-right')
          collapseButton.setAttribute('aria-expanded', 'false')
        } else {
          collapseButton.classList.add('carbon:chevron-down')
          collapseButton.setAttribute('aria-expanded', 'true')
        }
        collapseButton.addEventListener('click', function (e) {
          e.stopPropagation()
          toggleCollapsed(taskContainer, task)
        })
        return collapseButton
      },
      nameInputField: function (task, taskIndex) {
        const input = document.createElement('input')
        input.classList.add('task-name')

        const taskName = l('defaultTaskName').replace('%n', taskIndex + 1)

        input.placeholder = taskName
        input.value = task.name || taskName
        input.spellcheck = false

        input.addEventListener('keyup', function (e) {
          if (e.keyCode === 13) {
            this.blur()
          }

          tasks.update(task.id, { name: this.value })
        })

        input.addEventListener('focusin', function (e) {
          if (tasks.isCollapsed(task.id)) {
            this.blur()
            return
          }
          this.select()
        })
        return input
      },
      deleteButton: function (container, task) {
        const deleteButton = document.createElement('button')
        deleteButton.className = 'task-delete-button i carbon:trash-can'
        deleteButton.tabIndex = -1 // needed for keyboardNavigationHelper

        deleteButton.addEventListener('click', function (e) {
          if (task.tabs.isEmpty()) {
            container.remove()
            browserUI.closeTask(task.id)
          } else {
            container.classList.add('deleting')
            setTimeout(function () {
              if (container.classList.contains('deleting')) {
                container.style.opacity = 0
                // transitionend would be nice here, but it doesn't work if the element is removed from the DOM
                setTimeout(function () {
                  container.remove()
                  browserUI.closeTask(task.id)
                }, 500)
              }
            }, 10000)
          }
        })
        return deleteButton
      },
      deleteWarning: function (container, task) {
        const deleteWarning = document.createElement('div')
        deleteWarning.className = 'task-delete-warning'

        deleteWarning.innerHTML = l('taskDeleteWarning').unsafeHTML
        deleteWarning.addEventListener('click', function (e) {
          container.classList.remove('deleting')
        })
        return deleteWarning
      },

      actionContainer: function (taskContainer, task, taskIndex) {
        const taskActionContainer = document.createElement('div')
        taskActionContainer.className = 'task-action-container'

        // add the collapse button
        const collapseButton = this.collapseButton(taskContainer, task)
        taskActionContainer.appendChild(collapseButton)

        // add the input for the task name
        const input = this.nameInputField(task, taskIndex)
        taskActionContainer.appendChild(input)

        // add resource button
        const addResourceButton = document.createElement('button')
        addResourceButton.className = 'task-add-resource-button i carbon:link'
        addResourceButton.title = l('taskAddResource')
        addResourceButton.addEventListener('click', function (e) {
          e.stopPropagation()
          var url = window.prompt('Enter resource URL or path:')
          if (url) {
            const resources = task.resources || []
            resources.push({ url, title: url })
            tasks.update(task.id, { resources })
            // Re-render handled by state sync or we could manually update.
            // taskOverlay.render() is called on state-sync-change in taskOverlay.js
          }
        })
        taskActionContainer.appendChild(addResourceButton)

        // add the delete button
        const deleteButton = this.deleteButton(taskContainer, task)
        taskActionContainer.appendChild(deleteButton)

        return taskActionContainer
      },
      infoContainer: function (task) {
        const infoContainer = document.createElement('div')
        infoContainer.className = 'task-info-container'

        const date = getTaskRelativeDate(task)

        if (date) {
          const dateEl = document.createElement('span')
          dateEl.className = 'task-date'
          dateEl.textContent = date
          infoContainer.appendChild(dateEl)
        }

        const lastTabEl = document.createElement('span')
        lastTabEl.className = 'task-last-tab-title'
        let lastTabTitle = task.tabs.get().sort((a, b) => b.lastActivity - a.lastActivity)[0].title

        if (lastTabTitle) {
          lastTabTitle = searchbarUtils.getRealTitle(lastTabTitle)
          if (lastTabTitle.length > 40) {
            lastTabTitle = lastTabTitle.substring(0, 40) + '...'
          }
          lastTabEl.textContent = searchbarUtils.getRealTitle(lastTabTitle)
        }
        infoContainer.appendChild(lastTabEl)

        let favicons = []
        const faviconURLs = []

        task.tabs.get().sort((a, b) => b.lastActivity - a.lastActivity).forEach(function (tab) {
          if (tab.favicon) {
            favicons.push(tab.favicon)
            faviconURLs.push(tab.favicon.url)
          }
        })

        if (favicons.length > 0) {
          const faviconsEl = document.createElement('span')
          faviconsEl.className = 'task-favicons'
          favicons = favicons.filter((i, idx) => faviconURLs.indexOf(i.url) === idx)

          favicons.forEach(function (favicon) {
            const img = document.createElement('img')
            img.src = favicon.url
            if (favicon.luminance < faviconMinimumLuminance) {
              img.classList.add('dark-favicon')
            }
            faviconsEl.appendChild(img)
          })

          infoContainer.appendChild(faviconsEl)
        }

        return infoContainer
      },
      container: function (task, taskIndex, events) {
        const container = document.createElement('div')
        container.className = 'task-container'

        if (task.id !== tasks.getSelected().id && tasks.isCollapsed(task.id)) {
          container.classList.add('collapsed')
        }
        if (task.id === tasks.getSelected().id) {
          container.classList.add('selected')
        }
        container.setAttribute('data-task', task.id)

        container.addEventListener('click', function (e) {
          if (tasks.isCollapsed(task.id)) {
            toggleCollapsed(container, task)
          }
        })

        const taskActionContainer = this.actionContainer(
          container,
          task,
          taskIndex
        )
        container.appendChild(taskActionContainer)

        const infoContainer = this.infoContainer(task)
        container.appendChild(infoContainer)

        const deleteWarning = this.deleteWarning(container, task)
        container.appendChild(deleteWarning)

        if (task.resources && task.resources.length > 0) {
          const resourceContainer = TaskOverlayBuilder.create.resource.container(task, events)
          container.appendChild(resourceContainer)
        }

        const tabContainer = TaskOverlayBuilder.create.tab.container(task, events)
        container.appendChild(tabContainer)

        return container
      }
    },

    resource: {
      element: function (task, resource, index, events) {
        const data = {
          title: resource.title || resource.url,
          secondaryText: resource.url,
          icon: 'carbon:link',
          delete: function () {
            const resources = task.resources
            resources.splice(index, 1)
            tasks.update(task.id, { resources })
          },
          showDeleteButton: true
        }

        const el = searchbarUtils.createItem(data)
        el.classList.add('task-resource-item')

        el.addEventListener('click', function (e) {
          browserUI.addTab(tabs.add({ url: resource.url, private: false }), { enterEditMode: false, openInBackground: false })
          if (events && events.overlayHide) {
            events.overlayHide()
          }
        })

        return el
      },

      container: function (task, events) {
        const container = document.createElement('ul')
        container.className = 'task-resources-container'

        task.resources.forEach(function (resource, index) {
          container.appendChild(TaskOverlayBuilder.create.resource.element(task, resource, index, events))
        })

        return container
      }
    },

    tab: {
      element: function (tabContainer, task, tab, events) {
        const data = {
          classList: ['task-tab-item'],
          delete: events.tabDelete,
          showDeleteButton: true
        }

        if (tab.private) {
          data.icon = 'carbon:view-off'
        } else if (tab.favicon) {
          data.iconImage = tab.favicon.url

          if (tab.favicon.luminance && tab.favicon.luminance < faviconMinimumLuminance) {
            data.classList.push('has-dark-favicon')
          }
        }

        const source = urlParser.getSourceURL(tab.url)
        const searchQuery = searchEngine.getSearch(source)

        if (searchQuery) {
          data.title = searchQuery.search
          data.secondaryText = searchQuery.engine
        } else {
          data.title = tab.title || l('newTabLabel')
          data.secondaryText = urlParser.basicURL(source)
        }

        const el = searchbarUtils.createItem(data)

        el.setAttribute('data-tab', tab.id)

        el.addEventListener('click', function (e) {
          if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
            events.tabSelect.call(this, e)
          }
        })
        return el
      },

      container: function (task, events) {
        const tabContainer = document.createElement('ul')
        tabContainer.className = 'task-tabs-container'
        tabContainer.setAttribute('data-task', task.id)

        if (task.tabs) {
          for (let i = 0; i < task.tabs.count(); i++) {
            const el = this.element(tabContainer, task, task.tabs.getAtIndex(i), events)
            tabContainer.appendChild(el)
          }
        }

        return tabContainer
      }
    }
  }
// extend with other helper functions?
}

module.exports = function createTaskContainer (task, index, events) {
  return TaskOverlayBuilder.create.task.container(task, index, events)
}
