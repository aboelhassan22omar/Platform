/*
 * مكتبتي: the lessons saved on this phone, playable with no connection.
 *
 * Reads the index the site writes when a lesson is downloaded
 * (frontend/src/features/app/offline-library.ts — keep the format in step)
 * and plays the MP4 straight from the app's private storage. Time watched
 * here is added to `pendingSeconds`; the site reports it the next time the
 * phone is online, so offline watching counts toward the lesson's views.
 */
(function () {
  'use strict';

  var SITE = 'https://amr.aurexis.cc/';
  var DIR = 'LIBRARY_NO_CLOUD';
  var INDEX = 'offline/index.json';
  var cap = window.Capacitor || {};
  var plugins = cap.Plugins || {};
  var fs = plugins.Filesystem;

  var list = document.getElementById('list');
  var usage = document.getElementById('usage');
  var player = document.getElementById('player');
  var video = document.getElementById('video');
  var playing = document.getElementById('playing');
  var watermark = document.getElementById('watermark');

  var index = { version: 1, userId: null, items: [] };
  var current = null;
  var lastTime = 0;
  var unsaved = 0;
  var drift = null;

  if (plugins.SplashScreen) plugins.SplashScreen.hide({ fadeOutDuration: 300 }).catch(function () {});

  var digits = function (value) {
    return Number(value).toLocaleString('ar-EG');
  };
  var size = function (bytes) {
    return bytes >= 1e9
      ? (bytes / 1e9).toLocaleString('ar-EG', { maximumFractionDigits: 1 }) + ' جيجا'
      : digits(Math.max(1, Math.round(bytes / 1e6))) + ' ميجا';
  };
  var duration = function (seconds) {
    var minutes = Math.round(seconds / 60);
    if (minutes < 60) return digits(Math.max(1, minutes)) + ' دقيقة';
    var hours = Math.floor(minutes / 60);
    var rest = minutes % 60;
    return digits(hours) + ' ساعة' + (rest ? ' و' + digits(rest) + ' دقيقة' : '');
  };
  var expired = function (item) {
    return new Date(item.expiresAt).getTime() < Date.now();
  };
  var daysLeft = function (item) {
    return Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 86400000));
  };
  var el = function (tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key === 'className') node.className = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  };

  function load() {
    if (!fs) return Promise.resolve();
    return fs
      .readFile({ path: INDEX, directory: DIR, encoding: 'utf8' })
      .then(function (result) {
        var parsed = JSON.parse(result.data);
        if (parsed && parsed.version === 1 && Array.isArray(parsed.items)) index = parsed;
      })
      .catch(function () {});
  }

  function save() {
    if (!fs) return Promise.resolve();
    unsaved = 0;
    return fs
      .writeFile({ path: INDEX, directory: DIR, data: JSON.stringify(index), encoding: 'utf8', recursive: true })
      .catch(function () {});
  }

  function render() {
    list.textContent = '';
    var total = index.items.reduce(function (sum, item) {
      return sum + (item.sizeBytes || 0);
    }, 0);
    usage.textContent = index.items.length
      ? digits(index.items.length) + (index.items.length === 1 ? ' حصة' : ' حصص') + '، واخدين ' + size(total)
      : '';

    if (!fs) {
      list.appendChild(
        el('div', { className: 'empty' }, [
          el('strong', { text: 'المكتبة مش متاحة على الجهاز ده' }),
          el('span', { text: 'حدّث التطبيق من المتجر وجرّب تاني.' }),
        ]),
      );
      return;
    }
    if (!index.items.length) {
      list.appendChild(
        el('div', { className: 'empty' }, [
          el('strong', { text: 'لسه منزّلتش حصص' }),
          el('span', {
            text: 'لما تكون متصل بالنت، افتح أي حصة من حصصك ودوس «نزّل الحصة وشوفها من غير نت»، وهتلاقيها هنا.',
          }),
        ]),
      );
      return;
    }

    index.items.forEach(function (item) {
      var isExpired = expired(item);
      var thumb = el('button', { type: 'button', className: 'thumb', 'aria-label': 'شغّل ' + item.title });
      thumb.addEventListener('click', function () {
        open(item);
      });
      if (item.poster) {
        fs.readFile({ path: item.poster, directory: DIR, encoding: 'utf8' })
          .then(function (result) {
            thumb.style.backgroundImage = 'url("' + result.data + '")';
          })
          .catch(function () {});
      }
      var remove = el('button', { type: 'button', className: 'ghost danger', text: 'امسح' });
      remove.addEventListener('click', function () {
        if (window.confirm('تمسح «' + item.title + '» من موبايلك؟')) removeItem(item);
      });
      var status = isExpired
        ? el('p', { className: 'warn', text: 'محتاجة نت عشان تتجدد. افتح المنصة وانت متصل.' })
        : el('p', {
            text:
              duration(item.durationSeconds) +
              '، ' +
              size(item.sizeBytes) +
              '، تشتغل من غير نت ' +
              (daysLeft(item) === 1 ? 'يوم كمان' : digits(daysLeft(item)) + ' يوم كمان'),
          });
      list.appendChild(
        el('article', { className: 'card' + (isExpired ? ' expired' : '') }, [
          thumb,
          el('div', { className: 'meta' }, [
            el('h2', { text: item.title }),
            el('p', { text: item.courseTitle + (item.gradeName ? '، ' + item.gradeName : '') }),
            status,
            el('div', { className: 'row' }, [remove]),
          ]),
        ]),
      );
    });
  }

  function removeItem(item) {
    var drop = function (path) {
      return path ? fs.deleteFile({ path: path, directory: DIR }).catch(function () {}) : Promise.resolve();
    };
    Promise.all([drop(item.file), drop(item.poster)]).then(function () {
      index.items = index.items.filter(function (entry) {
        return entry.lessonId !== item.lessonId;
      });
      save().then(render);
    });
  }

  function moveWatermark() {
    watermark.style.top = 6 + Math.random() * 78 + '%';
    watermark.style.left = 4 + Math.random() * 60 + '%';
  }

  function open(item) {
    if (expired(item)) {
      window.alert('الحصة دي محتاجة تتجدد. افتح المنصة وانت متصل بالنت، وهتشتغل تاني على طول.');
      return;
    }
    fs.getUri({ path: item.file, directory: DIR }).then(function (result) {
      current = item;
      playing.textContent = item.title;
      watermark.textContent = item.watermark || '';
      watermark.style.display = item.watermark ? 'block' : 'none';
      moveWatermark();
      drift = window.setInterval(moveWatermark, 7000);
      video.src = cap.convertFileSrc ? cap.convertFileSrc(result.uri) : result.uri;
      player.classList.add('open');
      video.addEventListener(
        'loadedmetadata',
        function resume() {
          video.removeEventListener('loadedmetadata', resume);
          var at = item.positionSeconds || 0;
          if (at > 5 && at < (video.duration || item.durationSeconds) - 10) video.currentTime = at;
          lastTime = video.currentTime;
        },
      );
      video.play().catch(function () {});
    }).catch(function () {
      window.alert('ملف الحصة مش موجود على الموبايل. نزّلها تاني وانت متصل بالنت.');
    });
  }

  function close() {
    if (!current) return;
    video.pause();
    current.positionSeconds = Math.floor(video.currentTime || 0);
    current = null;
    window.clearInterval(drift);
    video.removeAttribute('src');
    video.load();
    player.classList.remove('open');
    save().then(render);
  }

  // Count only time actually played: seeking ahead or back is not watching.
  video.addEventListener('timeupdate', function () {
    if (!current) return;
    var now = video.currentTime;
    var delta = now - lastTime;
    lastTime = now;
    if (video.paused || delta <= 0 || delta > 2) return;
    current.pendingSeconds = (current.pendingSeconds || 0) + delta;
    current.positionSeconds = Math.floor(now);
    unsaved += delta;
    if (unsaved >= 10) save();
  });
  video.addEventListener('seeked', function () {
    lastTime = video.currentTime;
  });
  video.addEventListener('pause', function () {
    if (current) save();
  });
  video.addEventListener('ended', function () {
    if (current) current.positionSeconds = 0;
    save();
  });
  window.addEventListener('pagehide', function () {
    if (current) save();
  });

  document.getElementById('close').addEventListener('click', close);
  document.getElementById('online').addEventListener('click', function () {
    window.location.replace(SITE);
  });
  if (plugins.App) {
    plugins.App.addListener('backButton', function () {
      if (current) close();
      else window.location.replace(SITE);
    });
  }

  load().then(render);
})();
