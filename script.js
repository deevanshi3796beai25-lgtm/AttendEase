/* AttendEase — shared script.js (loaded on every page).
   Each feature checks that its elements exist, so one file serves all pages. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d, area = localStorage) { try { return JSON.parse(area.getItem(k)) ?? d; } catch { return d; } },
    set(k, v, area = localStorage) { try { area.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } },
    del(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ } }
  };
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  /* ---------- Shared: navbar shadow, footer year, loader, auth state ---------- */
  const navbar = $('.navbar');
  const onScroll = () => navbar && navbar.classList.toggle('scrolled', scrollY > 10);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const fb = $('.footer-bottom');
  if (fb) fb.textContent = fb.textContent.replace(/\d{4}/, new Date().getFullYear());

  // Intro loader: play once per browser session, remove it from the DOM afterwards
  const loader = $('#loader');
  if (loader) {
    if (store.get('ae_loaded', false, sessionStorage)) loader.remove();
    else setTimeout(() => { loader.remove(); store.set('ae_loaded', true, sessionStorage); }, 2600);
  }

  // Password hashing (SHA-256 + per-user salt). Still demo-grade: real auth needs a backend.
  async function hash(text, salt) {
    if (!(window.crypto && crypto.subtle)) throw new Error('nosubtle');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const getSession = () => store.get('ae_session', null) || store.get('ae_session', null, sessionStorage);

  // Navbar: show "Hi, name" + Log out when signed in
  const actions = $('.nav-actions');
  const s = getSession();
  if (actions && s) {
    actions.innerHTML = '<span class="user-chip"></span><button type="button" class="btn btn-outline" id="logout">Log out</button>';
    $('.user-chip', actions).textContent = 'Hi, ' + s.name.split(' ')[0];
    $('#logout').addEventListener('click', () => { store.del('ae_session'); location.href = 'index.html'; });
  }

  // Inline form status helper
  function statusEl(form) {
    let el = $('.form-status', form);
    if (!el) { el = document.createElement('p'); el.className = 'form-status'; el.setAttribute('role', 'alert'); $('button[type="submit"]', form).before(el); }
    return el;
  }
  function fieldError(input, msg) {
    let err = input.nextElementSibling;
    if (!err || !err.classList.contains('field-error')) { err = document.createElement('small'); err.className = 'field-error'; input.after(err); }
    err.textContent = msg;
    input.classList.toggle('invalid', !!msg);
    return !msg;
  }

  /* ---------- Sign up ---------- */
  const signup = $('form[action="login.html"]');
  if (signup) {
    signup.noValidate = true;
    signup.addEventListener('submit', async e => {
      e.preventDefault();       // stops the password being sent in the URL
      const f = signup.elements, st = statusEl(signup);
      const ok = [
        fieldError(f.name, f.name.value.trim().length < 2 ? 'Enter your full name.' : ''),
        fieldError(f.email, emailOk(f.email.value.trim()) ? '' : 'Enter a valid email address.'),
        fieldError(f.role, f.role.value ? '' : 'Choose a role.'),
        fieldError(f.password, f.password.value.length < 6 ? 'Use at least 6 characters.' : '')
      ].every(Boolean);
      if (!ok) return;
      const users = store.get('ae_users', []), email = f.email.value.trim().toLowerCase();
      if (users.some(u => u.email === email)) { st.textContent = 'This email is already registered. Log in instead.'; return; }
      try {
        const salt = crypto.getRandomValues(new Uint32Array(2)).join('');
        users.push({ name: f.name.value.trim(), email, role: f.role.value, salt, pass: await hash(f.password.value, salt) });
        store.set('ae_users', users);
        location.href = 'login.html?registered=1';
      } catch { st.textContent = 'Sign up needs https:// or localhost. Open the site through a local server.'; }
    });
  }

  /* ---------- Log in ---------- */
  const login = $('form[action="attendance.html"][method="get"]:has(#login-email)');
  if (login) {
    login.noValidate = true;
    const st = statusEl(login);
    if (new URLSearchParams(location.search).has('registered')) { st.className = 'form-status ok'; st.textContent = 'Account created. Log in to continue.'; }
    login.addEventListener('submit', async e => {
      e.preventDefault();
      const f = login.elements, email = f.email.value.trim().toLowerCase();
      st.className = 'form-status';
      const ok = [
        fieldError(f.email, emailOk(email) ? '' : 'Enter a valid email address.'),
        fieldError(f.password, f.password.value ? '' : 'Enter your password.')
      ].every(Boolean);
      if (!ok) return;
      const u = store.get('ae_users', []).find(x => x.email === email);
      try {
        const lockUntil = store.get('ae_login_lock_' + email, 0);
        if (lockUntil > Date.now()) { st.textContent = 'Too many failed attempts. Try again in ' + Math.ceil((lockUntil-Date.now())/1000) + ' seconds.'; return; }
        if (!u || (await hash(f.password.value, u.salt)) !== u.pass) {
          const attemptsKey = 'ae_login_attempts_' + email, attempts = store.get(attemptsKey, 0) + 1;
          if (attempts >= 3) { store.set('ae_login_lock_' + email, Date.now() + 30000); store.set(attemptsKey, 0); st.textContent = 'Three failed attempts. Login locked for 30 seconds.'; }
          else { store.set(attemptsKey, attempts); st.textContent = 'Email or password is incorrect. Attempt ' + attempts + ' of 3.'; }
          return;
        }
        store.set('ae_login_attempts_' + email, 0); store.set('ae_login_lock_' + email, 0);
      } catch { st.textContent = 'Log in needs https:// or localhost. Open the site through a local server.'; return; }
      const session = { name: u.name, email: u.email, role: u.role };
      store.set('ae_session', session, f.remember.checked ? localStorage : sessionStorage);
      location.href = 'attendance.html';
    });
  }

  /* ---------- Contact form: validate, then open the visitor's email app ---------- */
  const contact = $('.contact-form');
  if (contact) {
    contact.noValidate = true;
    contact.addEventListener('submit', e => {
      e.preventDefault();
      const f = contact.elements, st = statusEl(contact);
      const ok = [
        fieldError(f.name, f.name.value.trim().length < 2 ? 'Enter your name.' : ''),
        fieldError(f.email, emailOk(f.email.value.trim()) ? '' : 'Enter a valid email address.'),
        fieldError(f.subject, f.subject.value.trim() ? '' : 'Enter a subject.'),
        fieldError(f.message, f.message.value.trim().length < 10 ? 'Write at least 10 characters.' : '')
      ].every(Boolean);
      st.className = 'form-status ' + (ok ? 'ok' : '');
      if (!ok) { st.textContent = 'Fix the highlighted fields and try again.'; return; }
      const messages = store.get('ae_contact_messages', []);
      messages.push({name:f.name.value.trim(), email:f.email.value.trim(), subject:f.subject.value.trim(), message:f.message.value.trim(), createdAt:new Date().toISOString()});
      store.set('ae_contact_messages', messages);
      contact.reset();
      st.className = 'form-status ok';
      st.textContent = 'Message received in this browser demo. No email was sent because a backend is not connected.';
      toast('Message received (demo).');
    });
  }

  /* ---------- Attendance page: daily records, search, filters and live summary ---------- */
  const rows = $$('.att-row');
  const localDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const attendanceKey = date => 'ae_attendance_' + date;
  const getAttendanceHistory = () => Object.keys(localStorage)
    .filter(k => /^ae_attendance_\d{4}-\d{2}-\d{2}$/.test(k))
    .map(k => ({ date: k.slice('ae_attendance_'.length), records: store.get(k, {}) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (rows.length) {
    const today = store.get('ae_selected_attendance_date', localDateKey());
    const key = attendanceKey(today);
    const datePicker = $('#attendanceDate');
    if (datePicker) { datePicker.value = today; datePicker.addEventListener('change', () => { store.set('ae_selected_attendance_date', datePicker.value || localDateKey()); location.reload(); }); }
    const saved = store.get(key, {});
    const small = $('.dashboard-toolbar small');
    if (small) small.textContent = 'Today · ' + new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }).toUpperCase();

    const setRow = (row, present) => {
      const status = $('.status', row), btn = $('.small-btn', row);
      status.className = 'status ' + (present ? 'present' : 'absent');
      status.textContent = present ? 'Present' : 'Absent';
      btn.className = 'small-btn ' + (present ? 'absent-btn' : 'present-btn');
      btn.textContent = present ? 'Mark Absent' : 'Mark Present';
      btn.setAttribute('aria-label', `${btn.textContent}: ${$$('span', row)[0].textContent.trim()}`);
    };
    const getRowRoll = row => $$('span', row)[1].textContent.trim();
    const getRowName = row => $$('span', row)[0].textContent.replace(/^\S+\s*/, '').trim();
    const counts = () => {
      const present = $$('.att-row .status.present').length;
      const absent = $$('.att-row .status.absent').length;
      const total = rows.length;
      if ($('#presentCount')) $('#presentCount').textContent = present;
      if ($('#absentCount')) $('#absentCount').textContent = absent;
      const percent = total ? Math.round(present / total * 100) : 0;
      if ($('#attendanceRate')) $('#attendanceRate').textContent = percent + '%';
      if ($('#attendanceProgressFill')) $('#attendanceProgressFill').style.width = percent + '%';
      if ($('#attendanceProgress')) $('#attendanceProgress').setAttribute('aria-valuenow', percent);
      if ($('#attendanceSummaryText')) $('#attendanceSummaryText').textContent = `${present} of ${total} students are present today. ${absent} ${absent === 1 ? 'student is' : 'students are'} absent.`;
    };
    const applyFilters = () => {
      const query = ($('#studentSearch')?.value || '').trim().toLowerCase();
      const filter = $('#attendanceFilter')?.value || 'all';
      let visible = 0;
      rows.forEach(row => {
        const name = getRowName(row).toLowerCase();
        const roll = getRowRoll(row).toLowerCase();
        const status = $('.status', row).classList.contains('present') ? 'present' : 'absent';
        const show = (name.includes(query) || roll.includes(query)) && (filter === 'all' || filter === status);
        row.hidden = !show;
        if (show) visible++;
      });
      const message = $('#attendanceSearchMessage');
      if (message) message.textContent = `Showing ${visible} of ${rows.length} students`;
    };

    rows.forEach(row => {
      const roll = getRowRoll(row);
      if (Object.prototype.hasOwnProperty.call(saved, roll)) setRow(row, Boolean(saved[roll]));
      $('.small-btn', row).addEventListener('click', () => {
        const nowPresent = $('.status', row).classList.contains('absent');
        setRow(row, nowPresent);
        saved[roll] = nowPresent;
        store.set(key, saved);
        counts();
        applyFilters();
      });
    });

    $('#studentSearch')?.addEventListener('input', applyFilters);
    $('#attendanceFilter')?.addEventListener('change', applyFilters);

    // Arriving from Anti-Proxy with ?roll=101 marks that student present for today.
    const verifiedRoll = new URLSearchParams(location.search).get('roll');
    if (verifiedRoll) {
      const row = rows.find(r => getRowRoll(r) === verifiedRoll);
      if (row) {
        setRow(row, true); saved[verifiedRoll] = true; store.set(key, saved);
        row.classList.add('verified');
        if (row.scrollIntoView) row.scrollIntoView({ block: 'center' });
      }
    }
    counts();
    applyFilters();
  }

  /* ---------- Analytics: calculate metrics from saved daily attendance ---------- */
  const analyticsChart = $('#attendanceHistoryChart');
  if (analyticsChart) {
    const roster = rows.length ? rows.map(row => ({ roll: $$('span', row)[1].textContent.trim(), name: $$('span', row)[0].textContent.replace(/^\S+\s*/, '').trim() })) : [
      { roll: '101', name: 'Aditi Sharma' }, { roll: '102', name: 'Rohan Mehta' },
      { roll: '103', name: 'Simran Kaur' }, { roll: '104', name: 'Kabir Anand' }
    ];
    const history = getAttendanceHistory();
    const todayRecord = history.find(item => item.date === localDateKey());
    const today = todayRecord ? todayRecord.records : {};
    const presentToday = roster.filter(student => today[student.roll] === true).length;
    const recordedSessions = history.filter(item => roster.some(student => Object.prototype.hasOwnProperty.call(item.records, student.roll)));
    let totalMarked = 0, totalPresent = 0;
    const lowAttendance = roster.filter(student => {
      let marked = 0, present = 0;
      recordedSessions.forEach(session => {
        if (Object.prototype.hasOwnProperty.call(session.records, student.roll)) {
          marked++;
          if (session.records[student.roll] === true) present++;
        }
      });
      totalMarked += marked; totalPresent += present;
      return marked > 0 && (present / marked) < 0.75;
    });
    // Calculate overall percentage across all recorded student-days, not just today's class.
    totalMarked = 0; totalPresent = 0;
    recordedSessions.forEach(session => roster.forEach(student => {
      if (Object.prototype.hasOwnProperty.call(session.records, student.roll)) {
        totalMarked++;
        if (session.records[student.roll] === true) totalPresent++;
      }
    }));
    const overall = totalMarked ? totalPresent / totalMarked * 100 : null;
    $('#overallAttendance').textContent = overall === null ? '—' : overall.toFixed(1) + '%';
    $('#overallAttendanceNote').textContent = totalMarked ? `Across ${recordedSessions.length} recorded ${recordedSessions.length === 1 ? 'day' : 'days'}` : 'Mark attendance to start tracking';
    $('#analyticsPresentToday').textContent = todayRecord ? presentToday : '—';
    $('#analyticsPresentNote').textContent = todayRecord ? `out of ${roster.length} students` : 'No attendance saved today';
    $('#lowAttendanceCount').textContent = String(lowAttendance.length).padStart(2, '0');
    $('#lowAttendanceNote').textContent = totalMarked ? 'students below 75% of recorded sessions' : 'No history available yet';

    analyticsChart.innerHTML = '';
    const chartDays = recordedSessions.slice(-5);
    if (!chartDays.length) {
      const empty = document.createElement('p');
      empty.className = 'chart-empty';
      empty.textContent = 'No attendance history yet. Mark attendance on the Attendance page to build this chart.';
      analyticsChart.append(empty);
    } else {
      chartDays.forEach(session => {
        const marked = roster.filter(student => Object.prototype.hasOwnProperty.call(session.records, student.roll));
        const present = marked.filter(student => session.records[student.roll] === true).length;
        const percentage = marked.length ? present / marked.length * 100 : 0;
        const bar = document.createElement('i');
        bar.style.height = Math.max(percentage, 3) + '%';
        bar.title = `${session.date}: ${percentage.toFixed(1)}% (${present}/${marked.length} present)`;
        bar.setAttribute('role', 'img');
        bar.setAttribute('aria-label', bar.title);
        const label = document.createElement('b');
        label.textContent = new Date(session.date + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        bar.append(label);
        analyticsChart.append(bar);
      });
      $('#analyticsChartNote').textContent = `Last ${chartDays.length} recorded ${chartDays.length === 1 ? 'day' : 'days'}`;
    }
  }

  /* ---------- Anti-Proxy: check the roll number against the class list ---------- */
  const rollInput = $('#rollInput');
  if (rollInput) {
    const roster = ['101', '102', '103', '104'];   // same students as attendance.html
    const form = rollInput.form, result = $('.verify-result');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const current = new Date(), currentMinutes = current.getHours() * 60 + current.getMinutes();
      if (currentMinutes < 9 * 60 || currentMinutes > 9 * 60 + 15) {
        result.className = 'verify-result bad';
        result.textContent = 'Verification is open only from 9:00 AM to 9:15 AM (demo time window).';
        return;
      }
      const roll = rollInput.value.trim();
      if (!roster.includes(roll)) {
        result.className = 'verify-result bad';
        result.textContent = `Roll number ${roll || '(empty)'} is not in this class. Valid rolls: ${roster[0]}–${roster[roster.length - 1]}.`;
        return;
      }
      result.className = 'verify-result ok';
      result.textContent = `Roll ${roll} verified. Opening attendance...`;
      setTimeout(() => { location.href = 'attendance.html?roll=' + encodeURIComponent(roll); }, 900);
    });
  }

  /* ---------- Spin wheel: editable student list and random pick ---------- */
  const wheel = $('.wheel');
  if (wheel) {
    const btn = $('.spin-btn'), result = $('.spin-result'), title = $('.wheel-area h3'), note = $('.spin-note');
    const namesInput = $('#wheelNames'), updateNamesBtn = $('#updateWheelNames'), namesStatus = $('#wheelNamesStatus');
    let labels = $$('.wheel-label', wheel).map(label => label.textContent.trim());
    let rotation = 0, spinning = false;
    const palette = ['#2563eb', '#4f46e5', '#60a5fa', '#818cf8', '#3b82f6', '#6366f1', '#0ea5e9', '#7c3aed'];
    const renderWheel = names => {
      labels = names;
      wheel.innerHTML = '';
      const slice = 360 / labels.length;
      const gradient = labels.map((name, index) => `${palette[index % palette.length]} ${index * slice}% ${(index + 1) * slice}%`).join(', ');
      wheel.style.background = `conic-gradient(from ${-slice / 2}deg, ${gradient})`;
      labels.forEach((name, index) => {
        const label = document.createElement('span');
        label.className = 'wheel-label';
        label.textContent = name;
        const angle = index * slice;
        const radius = labels.length <= 4 ? 115 : labels.length <= 6 ? 130 : 138;
        label.style.transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-${radius}px) rotate(${-angle}deg)`;
        label.style.left = '50%'; label.style.top = '50%';
        wheel.append(label);
      });
      wheel.style.transform = 'rotate(0deg)';
      rotation = 0;
      if (namesStatus) namesStatus.textContent = `${labels.length} students on the wheel.`;
      if (result) { result.textContent = ''; result.classList.remove('show'); }
      if (note) note.textContent = `Each spin randomly selects one of ${labels.length} names.`;
    };
    renderWheel(labels);
    updateNamesBtn?.addEventListener('click', () => {
      if (spinning) return;
      const names = [...new Set(namesInput.value.split(/\r?\n/).map(name => name.trim()).filter(Boolean))];
      if (names.length < 2 || names.length > 8) {
        if (namesStatus) namesStatus.textContent = 'Please enter between 2 and 8 different names.';
        return;
      }
      namesInput.value = names.join('\n');
      renderWheel(names);
      if (title) title.textContent = 'Ready to pick?';
    });
    // A Promise lets the rest of the code wait until the wheel animation finishes.
    const waitForSpin = duration => new Promise(resolve => setTimeout(resolve, duration));

    btn.addEventListener('click', e => {
      e.preventDefault();
      if (spinning || labels.length < 2) return;
      spinning = true;
      result.classList.remove('show');
      title.textContent = 'Spinning...';
      const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
      const priorWinners = store.get('ae_wheel_history', []).map(item => item.name);
      const candidates = $('#avoidRepeatWinners')?.checked ? labels.filter(name => !priorWinners.includes(name)) : labels;
      if (!candidates.length) { result.textContent = 'Every student has already won. Reset winner history to start a new round.'; result.classList.add('show'); spinning = false; return; }
      const selectedName = candidates[Math.floor(random * candidates.length)];
      const pick = labels.indexOf(selectedName);
      const slice = 360 / labels.length;
      // Each slice is centred at its index angle; align the chosen centre with the pointer.
      const target = (Math.floor(rotation / 360) + 5) * 360 - pick * slice;
      rotation = target;
      wheel.style.transform = `rotate(${rotation}deg)`;

      waitForSpin(reduceMotion ? 100 : 4100)
        .then(() => {
          title.textContent = 'We have a winner!';
          result.textContent = '🎉 Landed on: ' + selectedName;
          result.classList.add('show');
        })
        .catch(error => {
          console.error('The spin could not be completed:', error);
          title.textContent = 'Something went wrong';
          result.textContent = 'Please try spinning again.';
          result.classList.add('show');
        })
        .finally(() => {
          // Always unlock the button, whether the Promise succeeds or fails.
          spinning = false;
        });
    });
  }

  /* ---------- Home hero: clickable Present/Absent + live rate ---------- */
  const pills = $$('.dashboard .student-row b');
  const rate = $('.top-float b');
  if (pills.length && rate) {
    pills.forEach(p => {
      p.setAttribute('role', 'button'); p.tabIndex = 0; p.title = 'Click to toggle';
      const toggle = () => {
        const present = p.classList.contains('absent');
        p.className = present ? 'present' : 'absent';
        p.textContent = present ? 'Present' : 'Absent';
        rate.textContent = (pills.filter(x => x.classList.contains('present')).length / pills.length * 100).toFixed(1) + '%';
      };
      p.addEventListener('click', toggle);
      p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });
  }

  /* ---------- Count-up numbers (home, about, analytics) ---------- */
  if (!reduceMotion) {
    const countUp = el => {
      const m = el.textContent.trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
      if (!m) return;
      const target = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, pad = m[1].split('.')[0].length, t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / 1400, 1), v = target * (1 - Math.pow(1 - p, 3));
        el.textContent = v.toFixed(dec).padStart(pad + (dec ? dec + 1 : 0), '0') + m[2];
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const obs = new IntersectionObserver((es, o) => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); o.unobserve(e.target); } }), { threshold: 0.6 });
    $$('.stats-grid strong, .metric strong').forEach(el => obs.observe(el));
  }

  /* Analytics bars are generated from saved records above. */

  /* ---------- Scroll reveal for home feature cards and steps ---------- */
  if (!reduceMotion) {
    const rev = new IntersectionObserver((es, o) => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible'); o.unobserve(e.target);
      setTimeout(() => { e.target.classList.remove('reveal', 'visible'); e.target.style.transitionDelay = ''; }, 900);  // keep hover effects
    }), { threshold: 0.15 });
    $$('.feature-card, .steps > div, .metric').forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 3) * 90 + 'ms'; rev.observe(el); });
  }

  /* ---------- Shared UX enhancements ---------- */
  // Persistent theme toggle, back-to-top and toast notifications.
  const themeKey = 'ae_dark_mode';
  const applyTheme = dark => { document.body.classList.toggle('dark-mode', !!dark); };
  applyTheme(store.get(themeKey, false));
  const themeButton = document.createElement('button'); themeButton.type='button'; themeButton.className='theme-toggle'; themeButton.textContent=document.body.classList.contains('dark-mode')?'☀ Light':'🌙 Dark'; themeButton.setAttribute('aria-label','Toggle dark mode');
  const navActions = $('.nav-actions'); if (navActions) navActions.prepend(themeButton); else { themeButton.classList.add('floating-theme'); document.body.append(themeButton); }
  themeButton.addEventListener('click',()=>{const next=!document.body.classList.contains('dark-mode');store.set(themeKey,next);applyTheme(next);themeButton.textContent=next?'☀ Light':'🌙 Dark';});
  const topButton=document.createElement('button');topButton.type='button';topButton.className='back-to-top';topButton.textContent='↑ Top';topButton.setAttribute('aria-label','Back to top');document.body.append(topButton);const updateTop=()=>topButton.classList.toggle('visible',scrollY>350);addEventListener('scroll',updateTop,{passive:true});updateTop();topButton.addEventListener('click',()=>scrollTo({top:0,behavior:reduceMotion?'auto':'smooth'}));
  function toast(message){let el=$('#aeToast');if(!el){el=document.createElement('div');el.id='aeToast';el.className='ae-toast';el.setAttribute('role','status');document.body.append(el);}el.textContent=message;el.classList.add('show');clearTimeout(el._timer);el._timer=setTimeout(()=>el.classList.remove('show'),3200);}

  // Password visibility and strength feedback.
  $$('[data-password-target]').forEach(button=>button.addEventListener('click',()=>{const input=$('#'+button.dataset.passwordTarget);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';button.textContent=show?'Hide':'Show';button.setAttribute('aria-label',show?'Hide password':'Show password');}));
  const signupPassword=$('#signup-password');if(signupPassword){signupPassword.addEventListener('input',()=>{const v=signupPassword.value;let score=0;if(v.length>=8)score++;if(/[a-z]/.test(v)&&/[A-Z]/.test(v))score++;if(/\d/.test(v))score++;if(/[^A-Za-z0-9]/.test(v))score++;const fill=$('#passwordStrengthFill'),label=$('#passwordStrengthText');if(fill)fill.style.width=(score*25)+'%';if(label)label.textContent=['Very weak','Weak','Fair','Good','Strong'][score];});}

  // Reflect any active demo lockout in the login button.
  const loginThrottleForm=$('form[action="attendance.html"][method="get"]:has(#login-email)');
  if(loginThrottleForm){const emailInput=loginThrottleForm.elements.email,submitButton=$('button[type="submit"]',loginThrottleForm);const refreshLock=()=>{const until=store.get('ae_login_lock_'+emailInput.value.trim().toLowerCase(),0);if(submitButton)submitButton.disabled=until>Date.now();};emailInput.addEventListener('input',refreshLock);refreshLock();}

  // Attendance bulk actions, undo stack and CSV export. Core row buttons already persist each click.
  if(rows.length){const historyStack=[];let suppressSnapshot=false;const snapshot=()=>rows.map(r=>({roll:$$('span',r)[1].textContent.trim(),present:$('.status',r).classList.contains('present')}));const saveSnapshot=()=>{historyStack.push(snapshot());if(historyStack.length>30)historyStack.shift();const b=$('#undoAttendance');if(b)b.disabled=false;};const bulk=(present)=>{saveSnapshot();suppressSnapshot=true;rows.forEach(row=>{const roll=$$('span',row)[1].textContent.trim();const status=$('.status',row);if(status.classList.contains(present?'absent':'present'))$('.small-btn',row).click();});suppressSnapshot=false;toast(present?'Marked all students present.':'Marked all students absent.');};$('#allPresent')?.addEventListener('click',()=>bulk(true));$('#allAbsent')?.addEventListener('click',()=>bulk(false));$('#undoAttendance')?.addEventListener('click',()=>{const old=historyStack.pop();if(!old)return;suppressSnapshot=true;old.forEach(item=>{const row=rows.find(r=>$$('span',r)[1].textContent.trim()===item.roll);if(row&&$('.status',row).classList.contains('present')!==item.present) $('.small-btn',row).click();});suppressSnapshot=false;$('#undoAttendance').disabled=!historyStack.length;toast('Last attendance change undone.');});
    rows.forEach(row=>$('.small-btn',row)?.addEventListener('click',()=>{if(!suppressSnapshot)saveSnapshot();},{capture:true}));
    $('#exportAttendance')?.addEventListener('click',()=>{const date=$('#attendanceDate')?.value||localDateKey();const data=store.get('ae_attendance_'+date,{});const csv=[['Date','Roll Number','Student','Status'],...rows.map(r=>[$('#attendanceDate')?.value||date,$$('span',r)[1].textContent.trim(),$$('span',r)[0].textContent.replace(/^\S+\s*/, '').trim(),Object.prototype.hasOwnProperty.call(data,$$('span',r)[1].textContent.trim())?(data[$$('span',r)[1].textContent.trim()]?'Present':'Absent'):'Not marked'])].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='attendance-'+date+'.csv';a.click();URL.revokeObjectURL(url);toast('Attendance CSV exported.');});}

  // Analytics date range, low-attendance student list and richer hover tooltip.
  if(analyticsChart){const from=$('#analyticsFrom'),to=$('#analyticsTo');const rerenderAnalytics=()=>{const history=getAttendanceHistory();const start=from?.value||'0000-00-00',end=to?.value||'9999-99-99';const sessions=history.filter(x=>x.date>=start&&x.date<=end&&Object.keys(x.records).length);const roster=[{roll:'101',name:'Aditi Sharma'},{roll:'102',name:'Rohan Mehta'},{roll:'103',name:'Simran Kaur'},{roll:'104',name:'Kabir Anand'}];let markedTotal=0,presentTotal=0;sessions.forEach(d=>Object.entries(d.records).forEach(([roll,present])=>{if(roster.some(st=>st.roll===roll)){markedTotal++;if(present===true)presentTotal++;}}));const overallEl=$('#overallAttendance');if(overallEl)overallEl.textContent=markedTotal?(presentTotal/markedTotal*100).toFixed(1)+'%':'—';const overallNote=$('#overallAttendanceNote');if(overallNote)overallNote.textContent=`Across ${sessions.length} recorded day${sessions.length===1?'':'s'} in selected range`;const list=$('#lowAttendanceList');if(list){list.innerHTML='';const low=roster.map(st=>{let n=0,p=0;sessions.forEach(d=>{if(Object.prototype.hasOwnProperty.call(d.records,st.roll)){n++;if(d.records[st.roll])p++;}});return {...st,n,p,rate:n?p/n*100:null};}).filter(x=>x.rate!==null&&x.rate<75);const lowCount=$('#lowAttendanceCount');if(lowCount)lowCount.textContent=String(low.length).padStart(2,'0');const lowNote=$('#lowAttendanceNote');if(lowNote)lowNote.textContent='students below 75% in selected date range';if(!low.length){list.textContent='No students below 75% in this date range.';}else{const h=document.createElement('h4');h.textContent='Students below 75%';list.append(h);low.forEach(x=>{const el=document.createElement('p');el.className='low-attendance-item';el.textContent=`${x.name} (${x.roll}) — ${x.rate.toFixed(1)}%`;list.append(el);});}}
      analyticsChart.innerHTML='';if(!sessions.length){const e=document.createElement('p');e.className='chart-empty';e.textContent='No attendance records in this date range.';analyticsChart.append(e);return;}sessions.slice(-14).forEach(session=>{const rolls=Object.keys(session.records),present=rolls.filter(r=>session.records[r]===true).length,pct=rolls.length?present/rolls.length*100:0;const bar=document.createElement('i');bar.style.height=Math.max(pct,3)+'%';bar.tabIndex=0;bar.className=pct<75?'low-bar':'';const tip=document.createElement('span');tip.className='chart-tooltip';tip.textContent=`${session.date}: ${pct.toFixed(1)}% (${present}/${rolls.length} present)`;bar.append(tip);bar.title=tip.textContent;bar.setAttribute('aria-label',tip.textContent);const label=document.createElement('b');label.textContent=new Date(session.date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'});bar.append(label);analyticsChart.append(bar);});const note=$('#analyticsChartNote');if(note)note.textContent=`${sessions.length} recorded day${sessions.length===1?'':'s'} in range`;};from?.addEventListener('change',rerenderAnalytics);to?.addEventListener('change',rerenderAnalytics);$('#clearAnalyticsFilter')?.addEventListener('click',()=>{if(from)from.value='';if(to)to.value='';rerenderAnalytics();});rerenderAnalytics();}

  // Anti-proxy verification time window and today's verified roll history.
  const verifiedList=$('#verifiedRolls');if(rollInput){const startMin=9*60,endMin=9*60+15;const now=new Date(),minutes=now.getHours()*60+now.getMinutes();const cameraStatus=$('#cameraStatus');const renderVerified=()=>{if(!verifiedList)return;verifiedList.innerHTML='';const list=store.get('ae_verified_'+localDateKey(),[]);if(!list.length){const li=document.createElement('li');li.textContent='No students verified yet today.';verifiedList.append(li);}list.forEach(x=>{const li=document.createElement('li');li.textContent=`${x.roll} — ${x.time}`;verifiedList.append(li);});};const originalSubmit=rollInput.form;originalSubmit.addEventListener('submit',e=>{const roll=rollInput.value.trim();if(!['101','102','103','104'].includes(roll))return;if(minutes<startMin||minutes>endMin){e.preventDefault();e.stopImmediatePropagation();const res=$('.verify-result');res.className='verify-result bad';res.textContent='Verification is open only from 9:00 AM to 9:15 AM (demo time window).';return;}const list=store.get('ae_verified_'+localDateKey(),[]);if(!list.some(x=>x.roll===roll)){list.push({roll,time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})});store.set('ae_verified_'+localDateKey(),list);}renderVerified();},{capture:true});renderVerified();const start=$('#startQrCamera'),stop=$('#stopQrCamera'),video=$('#qrCamera');let stream=null,scanTimer=null;start?.addEventListener('click',async()=>{if(!('BarcodeDetector'in window)){if(cameraStatus)cameraStatus.textContent='This browser does not support native QR detection. Try a current Chrome/Edge browser.';return;}try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});video.srcObject=stream;video.hidden=false;await video.play();start.hidden=true;stop.hidden=false;if(cameraStatus)cameraStatus.textContent='Camera active. Hold the QR code inside the frame.';const detector=new BarcodeDetector({formats:['qr_code']});scanTimer=setInterval(async()=>{try{const codes=await detector.detect(video);if(codes.length&&codes[0].rawValue){const val=codes[0].rawValue;const match=val.match(/(?:roll=)?(10[1-4])/);if(match){rollInput.value=match[1];rollInput.form.requestSubmit();stop.click();if(cameraStatus)cameraStatus.textContent='QR detected: '+match[1];}}}catch{}},500);}catch{if(cameraStatus)cameraStatus.textContent='Camera access failed. Allow camera permission and run this page on localhost or HTTPS.';}});const stopCamera=()=>{clearInterval(scanTimer);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;if(video){video.pause();video.srcObject=null;video.hidden=true;}if(start)start.hidden=false;if(stop)stop.hidden=true;};stop?.addEventListener('click',stopCamera);}

  // Spin wheel: persist names/history, avoid past winners, keep a winner history, and play a small tone.
  if(wheel){const historyKey='ae_wheel_history',namesKey='ae_wheel_names';const history=store.get(historyKey,[]);const histEl=$('#winnerHistory');const renderHistory=()=>{if(!histEl)return;histEl.innerHTML='';store.get(historyKey,[]).slice().reverse().forEach(item=>{const li=document.createElement('li');li.textContent=`${item.name} — ${item.date}`;histEl.append(li);});};const namesInput=$('#wheelNames');const savedNames=store.get(namesKey,null);if(savedNames&&namesInput)namesInput.value=savedNames.join('\n');renderHistory();$('#resetWheelWinners')?.addEventListener('click',()=>{store.set(historyKey,[]);renderHistory();toast('Winner history cleared.');});$('#avoidRepeatWinners')?.addEventListener('change',()=>toast($('#avoidRepeatWinners').checked?'Previous winners will be skipped.':'Previous winners may be picked again.'));$('#updateWheelNames')?.addEventListener('click',()=>{if(namesInput)store.set(namesKey,namesInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));});const spin=$('.spin-btn');spin?.addEventListener('click',()=>{if(namesInput)store.set(namesKey,namesInput.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));});const audioTone=()=>{try{const ctx=new (window.AudioContext||window.webkitAudioContext)(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.frequency.value=660;gain.gain.value=.04;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.09);osc.onended=()=>ctx.close();}catch{}};const oldText=$('.spin-result');const observeWinner=new MutationObserver(()=>{const m=oldText?.textContent.match(/Landed on: (.+)/);if(m){const name=m[1].trim(),current=store.get(historyKey,[]);if(!current.length||current[current.length-1].name!==name||Date.now()-current[current.length-1].ts>1500){current.push({name,date:new Date().toLocaleString(),ts:Date.now()});store.set(historyKey,current);renderHistory();audioTone();}}});if(oldText)observeWinner.observe(oldText,{childList:true,characterData:true,subtree:true});}

})();
