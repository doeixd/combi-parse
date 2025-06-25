class ViewArea extends HTMLElement {
  constructor() {
    super();
    this.viewTemplates = [];
  }

  connectedCallback() {
    console.log('<view-area> added to the DOM', this.getAttribute('view-id'));
  }

  addViewTemplate(viewTemplate) {
    this.viewTemplates.push(viewTemplate);
    this.update()
  }

  update() {
    // Clear current content
    this.innerHTML = '';
    if (this.viewTemplates.length === 0) return;

    // Check the mode of the last viewTemplate
    const lastTemplate = this.viewTemplates[this.viewTemplates.length - 1];
    const mode = lastTemplate.getMode();

    if (isReplace(mode)) {
      // Only render the last template
      const content = lastTemplate.content.cloneNode(true);
      this.appendChild(content);
    } else {
      // Append all templates
      this.viewTemplates.forEach(viewTemplate => {
        const content = viewTemplate.content.cloneNode(true);
        this.appendChild(content);
      });
    }
  }
}

function normalizeString(str) {
  return toString(str).trim().toLowerCase();
}

function toString(x) {
  if (typeof x === 'string') return x;
  try {
    const fromConstructor = String(x);
    if (typeof fromConstructor === 'string') return fromConstructor;
    throw new Error('Cannot convert to string');
  } catch (e) {
    return '';
  }
}

function isReplace(str) {
  return normalizeString(str) === 'replace';
}

customElements.define('view-area', ViewArea);

// Simple route matcher supporting parameters like /articles/:article-id
function matchRoute(pattern, path) {
  if (!pattern) return true; // No pattern means always match
  const patternParts = pattern.split('/').filter(Boolean);
  const pathParts = path.split('/').filter(Boolean);
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, i) => part.startsWith(':') || part === pathParts[i]);
}

function getCurrentPath() {
  return window.location.pathname;
}

// Navigation event subscription helper
const navigationListeners = new Set();

function subscribeToNavigationEvents(listener) {
  navigationListeners.add(listener);
  // Modern: Navigation API
  if ('navigation' in window && window.navigation.addEventListener) {
    window.navigation.addEventListener('navigate', listener);
  } else {
    // Legacy: popstate and custom pushstate/replacestate
    window.addEventListener('popstate', listener);
    window.addEventListener('pushstate', listener);
    window.addEventListener('replacestate', listener);
  }
}

function unsubscribeFromNavigationEvents(listener) {
  navigationListeners.delete(listener);
  if ('navigation' in window && window.navigation.removeEventListener) {
    window.navigation.removeEventListener('navigate', listener);
  } else {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('pushstate', listener);
    window.removeEventListener('replacestate', listener);
  }
}

// Patch pushState/replaceState to dispatch events for legacy support
(function patchHistoryMethods() {
  const methods = ['pushState', 'replaceState'];
  methods.forEach(type => {
    const orig = history[type];
    history[type] = function () {
      const result = orig.apply(this, arguments);
      const event = new Event(type.toLowerCase());
      window.dispatchEvent(event);
      return result;
    };
  });
})();

class ViewTemplate extends HTMLTemplateElement {
  constructor() {
    super();
    this._isVisible = false;
    this._onNavigate = this._onNavigate.bind(this);
  }

  getMode() {
    return this.getAttribute('mode');
  }

  getMatchPattern() {
    return this.getAttribute('match');
  }

  _onNavigate() {
    this.updateVisibility();
  }

  findViewAreas(viewId) {
    const viewAreaSelector = `view-area[view-id="${viewId}"]`;
    return Array.from(document.querySelectorAll(viewAreaSelector));
  }

  attachToViewArea(viewArea) {
    viewArea.addViewTemplate(this);
  }

  findAndAttachToViewAreas() {
    const viewAreas = this.findViewAreas(this.getAttribute('view-id'));
    viewAreas.forEach(viewArea => {
      this.attachToViewArea(viewArea);
    });
  }

  connectedCallback() {
    console.log('<view-template> added to the DOM', this.getAttribute('view-id'));
    this.findAndAttachToViewAreas();
    this.innerHTML = this.innerHTML;
    // Listen to navigation events (robust)
    subscribeToNavigationEvents(this._onNavigate);
    this.updateVisibility();
  }

  disconnectedCallback() {
    unsubscribeFromNavigationEvents(this._onNavigate);
  }

  updateVisibility() {
    const matchPattern = this.getMatchPattern();
    const currentPath = getCurrentPath();
    const shouldShow = matchRoute(matchPattern, currentPath);
    this.style.display = shouldShow ? '' : 'none';
    this._isVisible = shouldShow;
    // Optionally, could trigger re-attachment to view-areas if needed
  }
}
customElements.define('view-template', ViewTemplate);