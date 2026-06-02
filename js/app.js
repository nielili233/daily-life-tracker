window.Modal = {
  show: function(html) {
    document.getElementById('modal').innerHTML = html;
    document.getElementById('modal-overlay').classList.add('active');
  },
  hide: function() {
    document.getElementById('modal-overlay').classList.remove('active');
  }
};

window.App = {
  pages: {
    dashboard: Dashboard,
    schedule: Schedule,
    finance: Finance,
    goals: Goals,
    internship: Internship,
    notes: Notes
  },

  current: null,

  init: function() {
    var self = this;
    window.addEventListener('hashchange', function() { self.route(); });

    document.getElementById('modal-overlay').addEventListener('click', function(e) {
      if (e.target === e.currentTarget) Modal.hide();
    });

    setTimeout(function() {
      if (window.Store && Store.rolloverIncomplete) Store.rolloverIncomplete();
    }, 2000);

    this.route();
  },

  route: function() {
    var hash = location.hash.slice(1) || 'dashboard';
    var page = this.pages[hash];
    if (!page) { location.hash = '#dashboard'; return; }

    this.current = hash;
    document.getElementById('app').innerHTML = page.render();
    page.bind();

    document.querySelectorAll('.nav-item').forEach(function(el) {
      el.classList.toggle('active', el.getAttribute('data-page') === hash);
    });
  },

  refresh: function() {
    if (this.current && this.pages[this.current]) {
      document.getElementById('app').innerHTML = this.pages[this.current].render();
      this.pages[this.current].bind();
    }
  }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
