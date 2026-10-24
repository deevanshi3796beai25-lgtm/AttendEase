# AttendEase Multi-Page Website

Pages:
- index.html — home page + 2-second loader
- about.html — about/system overview
- login.html — login UI
- signup.html — registration UI
- attendance.html — attendance marking UI
- analytics.html — attendance analytics
- wheel.html — interactive spin wheel
- anti-proxy.html — anti-proxy verification demo
- contact.html — contact form
- style.css — shared responsive theme
- style.css — shared responsive theme and CSS-only loader/social-link styling

Open index.html in a browser to run it.

Important:
The site uses one shared script.js (loaded on every page) for validation, demo login, attendance toggling, the spin wheel, anti-proxy roll check and animations. Accounts are stored in the browser (localStorage) for demo purposes only; secure account creation and credential checking still require a backend/database. The anti-proxy page is a front-end demonstration only and requires a backend plus a legitimate identity-verification method for real protection.


ROUND 2 UPDATE (22 OCT 2026)
----------------------------
- Attendance dashboard: search by student name/roll number and filter by present/absent status.
- Live attendance summary: present/absent counts, attendance percentage and progress bar update when a status changes.
- Attendance records use the browser's local date and are saved per day in localStorage.
- Analytics metrics are calculated from saved attendance records rather than fixed sample values.
- Recent attendance chart shows up to five recorded dates. Historical/overall figures will become more meaningful as attendance is recorded on multiple days.
- Spin wheel: edit the student list (2-8 unique names) and make a random selection.
- Promise example: the spin wheel uses a Promise to wait for the animation, then uses .then(), .catch() and .finally() to show the result, handle errors and unlock the button.

HOW TO TEST
-----------
1. Open the folder in VS Code. For login/signup features, run it through a local server (for example VS Code Live Server) because Web Crypto may be unavailable from file:// URLs.
2. Open attendance.html and toggle a student's status. Check that counts and the progress bar update.
3. Search by a student's name or roll number and test each status filter.
4. Open analytics.html in the same browser to see today's metrics. Mark attendance on another date to build the history chart.
5. Open wheel.html, edit the list of names, click Update names, and spin. The winner appears after the animation Promise completes.
6. To review the Promise example, open script.js and search for `waitForSpin`. It demonstrates `new Promise()`, `.then()`, `.catch()` and `.finally()` with a real UI interaction.

NOTE
----
This remains a front-end demonstration: attendance and account data are stored in the current browser, not a secure server/database. Clear browser storage only if you are happy to remove the saved demo data.
