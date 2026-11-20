/* ============================================================
   PharmaPro – Core (API, UI kit, router, shell, auth, charts)
   ============================================================ */
(function () {
  'use strict';

  const App = (window.App = window.App || {});
  App.version = '1.0.0';
  App.views = {};
  App.state = {
    user: null, settings: {}, publicInfo: {}, notifications: null,
    shift: null, categories: null, currentRoute: 'dashboard'
  };

  /* ------------------------------------------------------------ */
  /*                              ICONS                           */
  /* ------------------------------------------------------------ */
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M8 7h8"/><path d="M8 11h8"/><path d="M8 15h5"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M10.27 21a2 2 0 0 0 3.46 0"/><path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.95 18 12.17 18 8A6 6 0 0 0 6 8c0 4.17-1.41 5.95-2.74 7.33"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    creditCard: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
    banknote: '<rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    barcode: '<path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>',
    folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    trendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    trendingDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    scale: '<path d="m16 16 3-8 3 8a5 5 0 0 1-6 0Z"/><path d="m2 16 3-8 3 8a5 5 0 0 1-6 0Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>',
    boxOpen: '<path d="M12 22v-9"/><path d="M15.17 2.21a1.67 1.67 0 0 1 1.63 0L21 4.57a1.93 1.93 0 0 1 0 3.36L8.82 14.79a1.655 1.655 0 0 1-1.64 0L3 12.43a1.93 1.93 0 0 1 0-3.36z"/><path d="M20 13v3.87a2.06 2.06 0 0 1-1.11 1.83l-6 3.08a1.93 1.93 0 0 1-1.78 0l-6-3.08A2.06 2.06 0 0 1 4 16.87V13"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    stethoscope: '<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    clipboardCheck: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>',
    arrowRightLeft: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
    coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    clockFast: '<path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/><path d="M22 2v6h-6"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    circleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    circleX: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    downloadCloud: '<path d="M12 13v8l-4-4"/><path d="m12 21 4-4"/><path d="M4.39 15A7 7 0 1 1 15 8h1a4 4 0 0 1 0 8h-1"/>',
    uploadCloud: '<path d="M12 13v8"/><path d="m8 17 4-4 4 4"/><path d="M4.39 15A7 7 0 1 1 15 8h1a4 4 0 0 1 0 8h-1"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.48 2 2 6.48 2 12c0 5.08 3.78 9.27 8.67 9.93.61.08 1.13-.43 1.02-1.04-.11-.56-.42-1.36-1.15-2.13-.63-.66-.99-1.55-.88-2.52.18-1.54 1.55-2.74 3.1-2.74H15c3.31 0 6-2.69 6-6 0-4.97-4.03-9-9-9z"/>',
    pharmacy: '<path d="M9 21h6"/><path d="M12 21v-3"/><path d="M7.5 11.5c0 3.5 1.8 5.2 4.5 5.2s4.5-1.7 4.5-5.2"/><path d="M7.5 11.5h9"/><path d="M8 11.5c.6-3 2-4.8 4-4.8s3.4 1.8 4 4.8"/><path d="M10.2 16.2c-1.7-1.4-2.3-3.6-1.3-5.4c.8-1.4 2.3-2.1 3.8-1.4c1.4.6 1.9 2.1 1.1 3.2c-.7.9-2 .9-2.7.1c-.5-.6-.4-1.5.3-1.9"/><path d="M10.8 12.8c.6-1.6.4-3.6-.6-5.2"/><path d="M10.2 7.6c.9-1 2-1.4 3.1-.8c.6.4.8 1.1.4 1.6c-.3.4-.9.4-1.2.1"/><path d="M13.7 6.8l.9-.6m-.9.6l.6.8"/><circle cx="12.8" cy="7.1" r=".35" fill="currentColor" stroke="none"/>'
  };

  App.icon = function (name, size) {
    const path = ICONS[name] || ICONS.info;
    const s = size || 18;
    return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  };

  /* ------------------------------------------------------------ */
  /*                              FORMAT                          */
  /* ------------------------------------------------------------ */
  const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  const fmt = App.fmt = {
    money(n, withCurrency) {
      const v = Number(n) || 0;
      return nf2.format(v) + (withCurrency === false ? '' : ' ' + App.currency());
    },
    number(n, digits) {
      const v = Number(n) || 0;
      return digits === 0 ? nf0.format(v) : nf2.format(v);
    },
    qty(n) {
      const v = Number(n) || 0;
      return Number.isInteger(v) ? String(v) : nf2.format(v);
    },
    compact(n) {
      const v = Number(n) || 0;
      if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + 'M';
      if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'k';
      return nf0.format(v);
    },
    date(s) {
      if (!s) return '—';
      const d = String(s).slice(0, 10).split('-');
      return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : String(s);
    },
    time(s) {
      if (!s) return '—';
      const t = String(s).slice(11, 16);
      return t || '—';
    },
    datetime(s) {
      if (!s) return '—';
      return `${fmt.date(s)} · ${fmt.time(s)}`;
    },
    month(s) {
      if (!s) return '—';
      const [y, m] = String(s).slice(0, 7).split('-');
      const names = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
      return `${names[Number(m) - 1] || m} ${y}`;
    },
    today() {
      const d = new Date();
      const p = (x) => String(x).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    addDays(dateStr, days) {
      const d = new Date((dateStr || fmt.today()) + 'T00:00:00');
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    },
    weekday() {
      return new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    },
    statusText(s) {
      return ({
        completed: 'مكتملة', void: 'ملغاة', returned: 'مرتجعة', partially_returned: 'مرتجع جزئي',
        received: 'مستلمة', open: 'مفتوحة', closed: 'مغلقة', pending: 'قيد الانتظار', cancelled: 'ملغاة',
        dispensed: 'تم الصرف', paid: 'مدفوعة', unpaid: 'غير مدفوعة', partial: 'مدفوعة جزئياً',
        partially_paid: 'مدفوعة جزئياً',
        cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة إلكترونية', credit: 'آجل'
      })[s] || s || '—';
    }
  };

  App.currency = () => (App.state.settings && App.state.settings.currency) || 'ج.م';
  App.esc = (s) => String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  App.can = (perm) => !!(App.state.user && (App.state.user.permissions || []).includes(perm));
  App.token = () => localStorage.getItem('pp_token') || '';

  const STATUS_TONE = {
    completed: 'success', received: 'success', paid: 'success', dispensed: 'success', open: 'success',
    returned: 'warning', partially_returned: 'warning', partially_paid: 'warning', partial: 'warning', pending: 'warning',
    void: 'danger', unpaid: 'danger', cancelled: 'danger', closed: '', draft: ''
  };
  App.badge = function (status) {
    return `<span class="badge ${STATUS_TONE[status] === undefined ? '' : STATUS_TONE[status]}">${App.esc(fmt.statusText(status))}</span>`;
  };
  App.payIcon = function (method) {
    return ({ cash: 'banknote', card: 'creditCard', wallet: 'smartphone', credit: 'wallet' })[method] || 'banknote';
  };
  App.formValues = function (container) {
    const out = {};
    const root = (container && container.querySelectorAll) ? container : document;
    root.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        out[el.name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) out[el.name] = el.value;
      } else {
        out[el.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
      }
    });
    return out;
  };
  App.downloadURL = function (url) {
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  };

  /* ------------------------------------------------------------ */
  /*                                API                           */
  /* ------------------------------------------------------------ */
  App.api = async function (path, opts = {}) {
    const { method = 'GET', body, auth = true, raw = false } = opts;
    const headers = {};
    if (auth && App.token()) headers.Authorization = 'Bearer ' + App.token();
    let payload;
    if (body !== undefined && body !== null) {
      if (body instanceof Blob || body instanceof ArrayBuffer || (typeof body === 'string' && raw)) {
        payload = body;
        headers['Content-Type'] = 'application/octet-stream';
      } else {
        payload = JSON.stringify(body);
        headers['Content-Type'] = 'application/json';
      }
    }
    let res;
    try {
      res = await fetch('/api' + path, { method, headers, body: payload });
    } catch (err) {
      throw new Error('تعذر الاتصال بالخادم. تأكد من تشغيله.');
    }
    if (res.status === 401 && auth) {
      App.logout(true);
      throw new Error('انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى');
    }
    const ct = res.headers.get('content-type') || '';
    let data = null;
    if (ct.includes('application/json')) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text();
    }
    if (!res.ok) {
      const msg = (data && data.error) || (typeof data === 'string' && data) || 'حدث خطأ غير متوقع';
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    return data;
  };

  /* ------------------------------------------------------------ */
  /*                              UI KIT                          */
  /* ------------------------------------------------------------ */
  const ui = App.ui = {};

  ui.modalStack = [];
  ui.modal = function ({ title, subtitle, body, footer, size = '', onMount, onClose, closeOnBackdrop = true }) {
    const root = document.getElementById('modal-root');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <div><h3>${title || ''}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
          <button class="modal-close" data-close aria-label="إغلاق">${App.icon('x')}</button>
        </div>
        <div class="modal-body">${body || ''}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div>`;
    root.appendChild(backdrop);
    const close = () => {
      backdrop.remove();
      const i = ui.modalStack.indexOf(handle);
      if (i >= 0) ui.modalStack.splice(i, 1);
      if (onClose) onClose();
    };
    const handle = { close, el: backdrop.querySelector('.modal'), body: backdrop.querySelector('.modal-body') };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop && closeOnBackdrop) close();
      if (e.target.closest('[data-close]')) close();
    });
    ui.modalStack.push(handle);
    setTimeout(() => {
      const first = backdrop.querySelector('input:not([type=hidden]), select, textarea, button.primary');
      if (first) first.focus();
    }, 60);
    if (onMount) onMount(handle);
    return handle;
  };

  ui.confirm = function ({ title = 'تأكيد', message = '', confirmText = 'تأكيد', cancelText = 'إلغاء', danger = false }) {
    return new Promise((resolve) => {
      const m = ui.modal({
        title, size: 'sm', closeOnBackdrop: false,
        body: `<div style="display:flex;gap:12px;align-items:flex-start">
          <div style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:${danger ? 'var(--danger-soft)' : 'var(--warning-soft)'};color:${danger ? 'var(--danger)' : 'var(--warning)'};flex:none">${App.icon('alert', 22)}</div>
          <div style="font-size:13.5px;color:var(--text-soft);line-height:1.7">${message}</div></div>`,
        footer: `<button class="btn" data-close>${cancelText}</button>
                 <button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${confirmText}</button>`,
        onMount: (h) => {
          h.el.querySelector('[data-yes]').onclick = () => { resolve(true); m.close(); };
        },
        onClose: () => resolve(false)
      });
    });
  };

  let toastSeq = 0;
  ui.toast = function (message, type = 'success', timeout = 3600) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const icon = type === 'error' ? 'circleX' : type === 'warning' ? 'alert' : 'circleCheck';
    el.innerHTML = `${App.icon(icon)}<span>${App.esc(message)}</span><button class="x" aria-label="إغلاق">${App.icon('x', 14)}</button>`;
    el.dataset.id = ++toastSeq;
    root.appendChild(el);
    const remove = () => { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 180); };
    el.querySelector('.x').onclick = remove;
    if (timeout) setTimeout(remove, timeout);
    return el;
  };

  ui.loading = function (target, text = 'جارٍ التحميل...') {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (el) el.innerHTML = `<div class="loading-block"><span class="spinner"></span><span>${text}</span></div>`;
  };

  ui.empty = function ({ icon = 'boxOpen', title = 'لا توجد بيانات', text = '', action = '' } = {}) {
    return `<div class="empty">
      <div class="icon-wrap">${App.icon(icon, 30)}</div>
      <h4>${title}</h4>${text ? `<p>${text}</p>` : ''}${action || ''}
    </div>`;
  };

  ui.table = function ({ columns = [], rows = [], empty, className = '', rowAttr }) {
    const head = columns.map((c) => `<th class="${c.thClass || ''}" ${c.width ? `style="width:${c.width}"` : ''}>${c.label || ''}</th>`).join('');
    const body = rows.length
      ? rows.map((row, i) => {
        const attrs = rowAttr ? rowAttr(row, i) : '';
        return `<tr ${attrs}>${columns.map((c) => {
          const val = c.render ? c.render(row, i) : App.esc(row[c.key] === undefined || row[c.key] === null ? '—' : row[c.key]);
          return `<td class="${c.tdClass || ''}">${val}</td>`;
        }).join('')}</tr>`;
      }).join('')
      : `<tr><td colspan="${columns.length}">${empty || ui.empty({})}</td></tr>`;
    return `<div class="table-wrap"><table class="table ${className}"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  ui.pager = function ({ page = 1, pages = 1, total = 0, perPage = 25 }) {
    if (!total) return '';
    const nums = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    for (let i = start; i <= end; i++) nums.push(i);
    if (start > 1) nums.unshift(1);
    if (start > 2) nums.splice(1, 0, '…');
    if (end < pages) nums.push(pages);
    if (end < pages - 1) nums.splice(nums.length - 1, 0, '…');
    return `<div class="table-footer">
      <span>إجمالي <b>${fmt.number(total, 0)}</b> سجل · صفحة ${page} من ${pages}</span>
      <div class="pager">
        <button class="pager-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>${App.icon('chevronRight', 14)}</button>
        ${nums.map((n) => n === '…' ? `<span class="pager-btn" style="border:0;background:none">…</span>`
          : `<button class="pager-btn ${n === page ? 'active' : ''}" data-page="${n}">${n}</button>`).join('')}
        <button class="pager-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>${App.icon('chevronLeft', 14)}</button>
      </div></div>`;
  };

  ui.bindPager = function (root, cb) {
    root.querySelectorAll('[data-page]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = Number(btn.dataset.page);
        if (p > 0 && !btn.disabled) cb(p);
      });
    });
  };

  ui.tabs = function (items, active) {
    return `<div class="tabs">${items.map((t) => `
      <button class="tab ${t.id === active ? 'active' : ''}" data-tab="${t.id}">
        ${t.icon ? App.icon(t.icon, 15) : ''}${t.label}${t.count !== undefined ? `<span class="count">${t.count}</span>` : ''}
      </button>`).join('')}</div>`;
  };
  ui.bindTabs = function (root, cb) {
    root.querySelectorAll('[data-tab]').forEach((btn) => btn.addEventListener('click', () => {
      root.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (cb) cb(btn.dataset.tab);
    }));
  };

  ui.pageHead = function ({ title, subtitle, actions = '' }) {
    return `<div class="page-head"><div><h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
      ${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
  };

  ui.stat = function ({ label, value, icon, tone = 'var(--primary)', tint = 'var(--primary-soft)', foot = '', valueHtml }) {
    return `<div class="stat-card" style="--tone:${tone};--tint:${tint}">
      <div class="stat-top"><div class="stat-icon">${App.icon(icon || 'chart', 20)}</div><div class="stat-label">${label}</div></div>
      <div class="stat-value">${valueHtml !== undefined ? valueHtml : value}</div>
      ${foot ? `<div class="stat-foot">${foot}</div>` : ''}
    </div>`;
  };

  ui.section = function ({ title, subtitle, actions, body, flush = false, className = '' }) {
    return `<div class="card ${className}">
      ${title ? `<div class="card-title"><div><h3>${title}</h3>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>` : ''}
      <div class="card-body ${flush ? 'flush' : ''}">${body || ''}</div></div>`;
  };

  ui.field = function ({ label, name, type = 'text', value = '', placeholder = '', required = false, hint = '', options = [], col = '', attrs = '', rows = 3, min, max, step, disabled = false, checked = false, dir = '' }) {
    const id = 'f_' + Math.random().toString(36).slice(2, 8);
    const a = `id="${id}" name="${name || ''}" ${attrs} ${disabled ? 'disabled' : ''} ${dir ? `dir="${dir}"` : ''} ${min !== undefined ? `min="${min}"` : ''} ${max !== undefined ? `max="${max}"` : ''} ${step !== undefined ? `step="${step}"` : ''}`;
    let control = '';
    if (type === 'select') {
      control = `<select class="select" ${a}>${options.map((o) => {
        const v = typeof o === 'object' ? o.value : o;
        const l = typeof o === 'object' ? o.label : o;
        return `<option value="${App.esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${App.esc(l)}</option>`;
      }).join('')}</select>`;
    } else if (type === 'textarea') {
      control = `<textarea class="textarea" rows="${rows}" ${a} placeholder="${App.esc(placeholder)}">${App.esc(value)}</textarea>`;
    } else if (type === 'checkbox' || type === 'switch') {
      const isSwitch = type === 'switch';
      if (isSwitch) {
        control = `<label class="switch"><input type="checkbox" ${a} ${value ? 'checked' : ''}><span></span></label>`;
        return `<div class="field ${col}"><label class="label">${label}${required ? '<span class="req">*</span>' : ''}</label>
          <div style="display:flex;align-items:center;gap:10px">${control}<span class="hint">${hint}</span></div></div>`;
      }
      control = `<label class="check"><input type="checkbox" ${a} ${value ? 'checked' : ''}><span><span class="check-title">${label}</span>${hint ? `<span class="check-sub">${hint}</span>` : ''}</span></label>`;
      return `<div class="field ${col}">${control}</div>`;
    } else {
      control = `<input class="input" type="${type}" ${a} value="${App.esc(value)}" placeholder="${App.esc(placeholder)}">`;
    }
    return `<div class="field ${col}">
      ${label ? `<label class="label" for="${id}">${label}${required ? '<span class="req">*</span>' : ''}</label>` : ''}
      ${control}${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  };

  ui.formGrid = function (fields, cls = '') { return `<div class="form-grid ${cls}">${fields.join('')}</div>`; };

  ui.moneyInput = function (name, value) {
    return `<input class="input num" type="number" name="${name}" value="${Number(value) || 0}" min="0" step="0.01">`;
  };

  ui.drawer = function ({ title, body, onMount, width }) {
    const root = document.getElementById('drawer-root');
    const wrap = document.createElement('div');
    wrap.className = 'drawer-backdrop';
    wrap.innerHTML = `<div class="drawer" style="${width ? `width:${width}px` : ''}">
      <div class="drawer-head"><h3>${title || ''}</h3><button class="modal-close" data-close style="margin-inline-start:auto">${App.icon('x')}</button></div>
      <div class="drawer-body">${body || ''}</div></div>`;
    root.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-close]')) close();
    });
    const handle = { close, el: wrap.querySelector('.drawer'), body: wrap.querySelector('.drawer-body') };
    ui.modalStack.push(handle);
    onMount && onMount(handle);
    return handle;
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.modalStack.length) {
      const top = ui.modalStack[ui.modalStack.length - 1];
      top.close();
    }
  });

  /* ------------------------------------------------------------ */
  /*                              CHARTS                          */
  /* ------------------------------------------------------------ */
  App.charts = {
    area(data, { height = 220, color = '#0d9488', valueKey = 'value', labelKey = 'label', currency = true } = {}) {
      const w = 640, h = height, pad = { top: 18, right: 12, bottom: 28, left: 46 };
      const innerW = w - pad.left - pad.right;
      const innerH = h - pad.top - pad.bottom;
      const values = data.map((d) => Number(d[valueKey]) || 0);
      const max = Math.max(...values, 1);
      const step = max > 0 ? max / 4 : 1;
      const y = (v) => pad.top + innerH - (v / max) * innerH;
      const x = (i) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
      const pts = data.map((d, i) => `${x(i)},${y(Number(d[valueKey]) || 0)}`).join(' ');
      const areaPts = `${pad.left},${pad.top + innerH} ${pts} ${pad.left + innerW},${pad.top + innerH}`;
      const grid = [0, 1, 2, 3, 4].map((i) => {
        const gy = pad.top + innerH - (i / 4) * innerH;
        return `<line x1="${pad.left}" x2="${w - pad.right}" y1="${gy}" y2="${gy}" stroke="currentColor" stroke-opacity=".1" stroke-dasharray="3 4"/>
          <text x="${pad.left - 8}" y="${gy + 3.5}" text-anchor="end" font-size="9.5" fill="currentColor" opacity=".55">${fmt.compact(step * i)}</text>`;
      }).join('');
      const skip = Math.ceil(data.length / 8);
      const xlabels = data.map((d, i) => (i % skip === 0 || i === data.length - 1)
        ? `<text x="${x(i)}" y="${h - 8}" text-anchor="middle" font-size="9.5" fill="currentColor" opacity=".55">${App.esc(d[labelKey])}</text>` : '').join('');
      const dots = data.map((d, i) => `<circle cx="${x(i)}" cy="${y(Number(d[valueKey]) || 0)}" r="2.6" fill="${color}"><title>${App.esc(d[labelKey])}: ${fmt.number(d[valueKey])}</title></circle>`).join('');
      return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px">
        <defs><linearGradient id="ag${Math.random().toString(36).slice(2, 7)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient></defs>
        <g color="currentColor">${grid}${xlabels}</g>
        <polygon points="${areaPts}" fill="${color}" opacity=".10"/>
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>
        ${dots}
      </svg>`;
    },
    bars(data, { height = 200, color = '#0d9488', valueKey = 'value', labelKey = 'label' } = {}) {
      const w = 640, h = height, pad = { top: 16, right: 10, bottom: 28, left: 40 };
      const innerW = w - pad.left - pad.right, innerH = h - pad.top - pad.bottom;
      const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
      const bw = innerW / Math.max(data.length, 1) * 0.55;
      const gap = innerW / Math.max(data.length, 1);
      const bars = data.map((d, i) => {
        const v = Number(d[valueKey]) || 0;
        const bh = (v / max) * innerH;
        const bx = pad.left + i * gap + (gap - bw) / 2;
        return `<rect x="${bx}" y="${pad.top + innerH - bh}" width="${bw}" height="${bh}" rx="4" fill="${color}" opacity=".85"><title>${App.esc(d[labelKey])}: ${fmt.number(v)}</title></rect>`;
      }).join('');
      return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px">${bars}</svg>`;
    },
    donut(items, { size = 150, thickness = 20 } = {}) {
      const colors = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#ef4444', '#64748b'];
      const total = items.reduce((s, it) => s + Number(it.value), 0) || 1;
      const r = (size - thickness) / 2, c = size / 2, circ = 2 * Math.PI * r;
      let offset = 0;
      const segs = items.map((it, i) => {
        const frac = Number(it.value) / total;
        const dash = frac * circ;
        const s = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${it.color || colors[i % colors.length]}" stroke-width="${thickness}"
          stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${c} ${c})" stroke-linecap="butt"><title>${App.esc(it.label)}: ${fmt.number(it.value)}</title></circle>`;
        offset += dash;
        return s;
      }).join('');
      const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}
        <circle cx="${c}" cy="${c}" r="${r - thickness / 2 - 4}" fill="var(--panel)" opacity=".001"/></svg>`;
      const legend = `<div class="legend-list">${items.map((it, i) => `
        <div class="legend-item"><span class="dot" style="background:${it.color || colors[i % colors.length]}"></span>
        <span class="name">${App.esc(it.label)}</span><span class="val">${fmt.compact(it.value)}</span></div>`).join('')}</div>`;
      return `<div class="donut-wrap"><div style="position:relative;height:${size}px;width:${size}px;flex:none">${svg}</div>${legend}</div>`;
    }
  };

  /* ------------------------------------------------------------ */
  /*                             BARCODE                          */
  /* ------------------------------------------------------------ */
  const CODE39 = {
    '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
    '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
    A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
    F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
    K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
    P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
    U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
    Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
    '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
  };

  App.barcode39 = function (value, { height = 48, narrow = 1.6, showText = true, fontSize = 10 } = {}) {
    const text = String(value || '').toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, '');
    const chars = ('*' + text + '*').split('');
    const bars = [];
    let x = 0;
    chars.forEach((ch, idx) => {
      const pattern = CODE39[ch] || CODE39['-'];
      pattern.split('').forEach((el, i) => {
        const w = (el === 'w' ? 2.6 : 1) * narrow;
        if (i % 2 === 0) bars.push({ x, w });
        x += w;
      });
      if (idx < chars.length - 1) x += narrow;
    });
    const totalW = Math.max(x, 1);
    const totalH = height + (showText ? fontSize + 3 : 0);
    const rects = bars.map((b) => `<rect x="${b.x.toFixed(2)}" y="0" width="${b.w.toFixed(2)}" height="${height}" fill="#000"/>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW.toFixed(2)} ${totalH}" preserveAspectRatio="none" style="width:100%;height:${totalH}px;background:#fff">
      ${rects}${showText ? `<text x="${totalW / 2}" y="${totalH - 1}" font-family="monospace" font-size="${fontSize}" text-anchor="middle" fill="#000">${App.esc(text)}</text>` : ''}</svg>`;
  };

  /* ------------------------------------------------------------ */
  /*                          PRINT / EXPORT                      */
  /* ------------------------------------------------------------ */
  const PRINT_CSS = `
    *{box-sizing:border-box}
    body{margin:0;font-family:"Segoe UI",Tahoma,sans-serif;direction:rtl;background:#fff;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .receipt{width:80mm;margin:0 auto;padding:3mm;font-size:11px;line-height:1.5}
    .receipt h2{font-size:16px;margin:0 0 2px;text-align:center}
    .receipt .r-sub{text-align:center;font-size:9px;color:#333}
    .receipt .r-meta{display:flex;justify-content:space-between;font-size:9.5px;margin:3px 0}
    .receipt .r-line{border-top:1px dashed #555;margin:6px 0}
    .receipt table{width:100%;border-collapse:collapse;font-size:9.5px}
    .receipt th{text-align:start;border-bottom:1px solid #333;padding:3px 0;font-size:9px}
    .receipt td{padding:2.5px 0;vertical-align:top}
    .receipt .r-total{display:flex;justify-content:space-between;font-size:11px;padding:2px 0}
    .receipt .r-total.grand{font-size:14px;font-weight:800;border-top:1px solid #333;margin-top:4px;padding-top:5px}
    .receipt .barcode{text-align:center;margin-top:6px}.receipt .barcode svg{width:52mm;height:13mm}
    .receipt .r-foot{text-align:center;font-size:9px;margin-top:5px}
    .receipt .r-thanks{text-align:center;font-size:9px;margin-top:4px;border-top:1px dashed #555;padding-top:5px}
    .print-a4{background:#fff;color:#000;padding:10mm 12mm;font-size:11px}
    .print-a4 .p-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:10px;margin-bottom:14px}
    .print-a4 .brandline{color:#0f766e;font-weight:800;font-size:21px}
    .print-a4 .meta{font-size:10px;color:#444;text-align:end;line-height:1.7}
    .print-a4 h1{font-size:18px;margin:0 0 2px}
    .print-a4 h2{font-size:15px;margin:14px 0 6px}
    .print-a4 table{width:100%;border-collapse:collapse;font-size:10.5px;margin:8px 0}
    .print-a4 th{background:#f1f5f9;text-align:start;padding:6px 7px;border:1px solid #cbd5e1;font-size:10px}
    .print-a4 td{padding:5px 7px;border:1px solid #dbe3ea}
    .print-a4 .num{text-align:end;font-variant-numeric:tabular-nums}
    .print-a4 .totals{width:45%;margin-inline-start:auto;margin-top:8px}
    .print-a4 .totals .row{display:flex;justify-content:space-between;padding:4px 7px;border-bottom:1px solid #e2e8f0}
    .print-a4 .totals .row.grand{background:#f0fdfa;font-weight:800;font-size:12px;border:1px solid #99f6e4}
    .print-a4 .signatures{display:flex;justify-content:space-between;margin-top:34px;font-size:10px;color:#444}
    .print-a4 .signatures div{border-top:1px dashed #999;padding-top:5px;width:28%;text-align:center}
    .print-note{font-size:9px;color:#666;margin-top:8px;text-align:center}
    @page{size:auto;margin:6mm}
  `;

  App.printHTML = function (inner, { title = 'طباعة', width = null } = {}) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(frame);
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${App.esc(title)}</title>
      <style>${PRINT_CSS}${width ? `@page{size:${width} auto;margin:3mm}` : ''}</style></head><body>${inner}</body></html>`);
    doc.close();
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (err) { App.ui.toast('تعذر فتح نافذة الطباعة', 'error'); }
      setTimeout(() => frame.remove(), 60000);
    }, 180);
  };

  App.receiptHTML = function (sale, opts = {}) {
    const s = App.state.settings;
    const items = sale.items || [];
    const cur = App.currency();
    const rows = items.map((it) => `<tr><td>${App.esc(it.name)}<div style="font-size:8px;color:#555">${App.esc(it.batch_no || '')}</div></td>
      <td style="text-align:center">${fmt.qty(it.qty)}</td><td style="text-align:end">${fmt.number(it.price)}</td>
      <td style="text-align:end">${fmt.number(it.total)}</td></tr>`).join('');
    return `<div class="receipt">
      <h2>${App.esc(s.pharmacy_name || 'صيدلية')}</h2>
      <div class="r-sub">${App.esc(s.pharmacy_name_en || '')}</div>
      <div class="r-sub">${App.esc(s.address || '')}</div>
      <div class="r-sub">هاتف: ${App.esc(s.phone || '')} ${s.tax_no ? ' · س.ض: ' + App.esc(s.tax_no) : ''}</div>
      <div class="r-line"></div>
      <div class="r-meta"><span>فاتورة: ${App.esc(sale.invoice_no)}</span><span>${fmt.datetime(sale.date)}</span></div>
      <div class="r-meta"><span>العميل: ${App.esc(sale.customer_name || 'عميل نقدي')}</span><span>الكاشير: ${App.esc(sale.cashier_name || sale.user_name || '')}</span></div>
      <div class="r-line"></div>
      <table><thead><tr><th>الصنف</th><th style="text-align:center">كمية</th><th style="text-align:end">سعر</th><th style="text-align:end">إجمالي</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="r-line"></div>
      <div class="r-total"><span>الإجمالي قبل الخصم</span><span>${fmt.number(sale.subtotal)} ${cur}</span></div>
      ${Number(sale.discount) ? `<div class="r-total"><span>الخصم</span><span>- ${fmt.number(sale.discount)} ${cur}</span></div>` : ''}
      ${Number(sale.tax) ? `<div class="r-total"><span>ض.ق.م</span><span>${fmt.number(sale.tax)} ${cur}</span></div>` : ''}
      <div class="r-total grand"><span>الإجمالي</span><span>${fmt.number(sale.total)} ${cur}</span></div>
      <div class="r-total"><span>المدفوع (${fmt.statusText(sale.payment_method)})</span><span>${fmt.number(sale.paid)} ${cur}</span></div>
      ${Number(sale.change_due) ? `<div class="r-total"><span>الباقي</span><span>${fmt.number(sale.change_due)} ${cur}</span></div>` : ''}
      <div class="barcode">${App.barcode39(sale.invoice_no.replace(/[^0-9A-Z]/gi, ''), { height: 38, narrow: 1.1, fontSize: 9 })}</div>
      <div class="r-thanks">${App.esc(s.receipt_footer || 'شكراً لتعاملكم معنا')}</div>
      <div class="r-foot">${App.esc(s.pharmacy_name || '')} · ${App.esc(s.phone || '')}</div>
      <div class="print-note">${opts.copy ? 'نسخة العميل' : ''}</div>
    </div>`;
  };

  App.printReceipt = function (sale) {
    App.printHTML(App.receiptHTML(sale), { title: 'فاتورة ' + sale.invoice_no, width: '80mm' });
  };

  App.printA4 = function (title, body) {
    const s = App.state.settings;
    const head = `<div class="p-head">
      <div><div class="brandline">${App.esc(s.pharmacy_name || 'PharmaPro')}</div>
      <div style="font-size:10px;color:#555">${App.esc(s.address || '')}</div>
      <div style="font-size:10px;color:#555">هاتف: ${App.esc(s.phone || '')} · سجل ضريبي: ${App.esc(s.tax_no || '')}</div></div>
      <div class="meta"><b style="font-size:13px;color:#0f766e">${App.esc(title)}</b><br>تاريخ الطباعة: ${fmt.date(fmt.today())}<br>${App.esc(App.state.user ? App.state.user.full_name : '')}</div>
    </div>`;
    App.printHTML(`<div class="print-a4">${head}${body}
      <div class="signatures"><div>المحاسب</div><div>الصيدلي المسؤول</div><div>الختم</div></div>
      <div class="print-note">تم إنشاء هذا التقرير بواسطة PharmaPro</div></div>`, { title });
  };

  App.exportCSV = function (filename, headers, rows) {
    const esc = (v) => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  App.exportExcel = function (filename, headers, rows) {
    const escXml = (v) => String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const head = headers.map((h) => `<Cell><Data ss:Type="String">${escXml(h)}</Data></Cell>`).join('');
    const body = rows.map((r) => `<Row>${r.map((v) => {
      const numeric = (typeof v === 'number' && !isNaN(v)) || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && !/^0[0-9]/.test(v.trim()));
      const type = numeric ? 'Number' : 'String';
      return `<Cell><Data ss:Type="${type}">${escXml(v)}</Data></Cell>`;
    }).join('')}</Row>`).join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Report">
  <Table>
   <Row>${head}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename.endsWith('.xls') ? filename : filename + '.xls';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  App.exportPDF = function (title, headers, rows) {
    const body = `<h1>${App.esc(title)}</h1>
      <table><thead><tr>${headers.map((h) => `<th>${App.esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${App.esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    App.printA4(title, body);
  };

  App.debounce = function (fn, ms = 300) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  App.sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ------------------------------------------------------------ */
  /*                          AUTH & SHELL                        */
  /* ------------------------------------------------------------ */
  App.logout = function (silent) {
    localStorage.removeItem('pp_token');
    App.state.user = null;
    if (!silent) App.ui.toast('تم تسجيل الخروج', 'success', 1500);
    renderLogin();
  };

  async function loadSettings() {
    try { App.state.settings = await App.api('/settings'); } catch (_) { App.state.settings = {}; }
  }

  App.reloadSettings = loadSettings;

  async function loadNotifications() {
    try {
      App.state.notifications = await App.api('/notifications');
      const badge = document.querySelector('[data-notif-dot]');
      if (badge) {
        const n = App.state.notifications;
        const count = (n.low_stock ? n.low_stock.length : 0) + (n.expiring ? n.expiring.length : 0) + (n.pending_rx || 0);
        badge.style.display = count ? 'block' : 'none';
      }
      const chip = document.querySelector('[data-shift-chip]');
      if (chip) {
        const shift = App.state.notifications.shift;
        chip.className = 'shift-chip ' + (shift ? '' : 'closed');
        chip.innerHTML = `${App.icon('clock', 13)} ${shift ? 'وردية مفتوحة' : 'لا توجد وردية'}`;
      }
    } catch (_) { /* ignore */ }
  }
  App.reloadNotifications = loadNotifications;

  const NAV = [
    { group: 'نظرة عامة', items: [{ id: 'dashboard', label: 'لوحة التحكم', icon: 'dashboard', perm: 'dashboard.view' }] },
    {
      group: 'التشغيل اليومي', items: [
        { id: 'pos', label: 'نقطة البيع', icon: 'cart', perm: 'pos.use' },
        { id: 'sales', label: 'المبيعات', icon: 'receipt', perm: 'sales.view' },
        { id: 'returns', label: 'المرتجعات', icon: 'rotate', perm: 'returns.manage' },
        { id: 'shifts', label: 'الورديات', icon: 'clock', perm: 'shifts.use' }
      ]
    },
    {
      group: 'المخزون والمشتريات', items: [
        { id: 'products', label: 'الأصناف والأدوية', icon: 'pill', perm: 'products.view' },
        { id: 'inventory', label: 'المخزون والصلاحية', icon: 'layers', perm: 'products.view' },
        { id: 'purchases', label: 'المشتريات', icon: 'truck', perm: 'purchases.view' },
        { id: 'suppliers', label: 'الموردون', icon: 'box', perm: 'suppliers.manage' }
      ]
    },
    {
      group: 'العملاء والروشتات', items: [
        { id: 'customers', label: 'العملاء', icon: 'users', perm: 'customers.manage' },
        { id: 'prescriptions', label: 'الروشتات الطبية', icon: 'clipboard', perm: 'prescriptions.manage' }
      ]
    },
    {
      group: 'المالية والتقارير', items: [
        { id: 'reports', label: 'التقارير', icon: 'chart', perm: 'reports.view' },
        { id: 'accounting', label: 'المحاسبة والميزانية', icon: 'wallet', perm: 'accounting.view' }
      ]
    },
    {
      group: 'إدارة النظام', items: [
        { id: 'users', label: 'المستخدمون والصلاحيات', icon: 'shield', perm: 'users.manage' },
        { id: 'backup', label: 'النسخ الاحتياطي', icon: 'database', perm: 'backup.manage' },
        { id: 'settings', label: 'الإعدادات', icon: 'settings', perm: 'settings.manage' },
        { id: 'audit', label: 'سجل النشاط', icon: 'activity', perm: 'audit.view' },
        { id: 'data-tools', label: 'أدوات البيانات', icon: 'database', perm: 'settings.manage' },
        { id: 'tutorials', label: 'فيديوهات الشرح', icon: 'eye', perm: 'dashboard.view' }
      ]
    }
  ];

  function navHTML() {
    return NAV.map((g) => {
      const items = g.items.filter((it) => App.can(it.perm));
      if (!items.length) return '';
      return `<div class="nav-group"><div class="nav-group-title">${g.group}</div>${items.map((it) => `
        <a class="nav-item" href="#/${it.id}" data-nav="${it.id}">${App.icon(it.icon)}<span>${it.label}</span></a>`).join('')}</div>`;
    }).join('');
  }

  function applyTheme(theme) {
    const id = theme || localStorage.getItem('pp_theme') || 'light';
    const resolved = themeModeOf(id);
    document.documentElement.dataset.theme = id;
    document.documentElement.dataset.mode = resolved;
    localStorage.setItem('pp_theme', id);
    localStorage.setItem(resolved === 'dark' ? 'pp_theme_dark' : 'pp_theme_light', id);
    const btn = document.querySelector('[data-theme-btn]');
    if (btn) btn.innerHTML = App.icon('palette');
  }
  App.THEMES = [
    { id:'light',        name:'فاتح (افتراضي)', mode:'light', colors:{ bg:'#f3f7f6', surface:'#ffffff', brand:'#0f766e', accent:'#14b8a6', text:'#0f172a' } },
    { id:'light-warm',   name:'فاتح دافئ',      mode:'light', colors:{ bg:'#fbf6ee', surface:'#fffdf8', brand:'#b45309', accent:'#f59e0b', text:'#2b2116' } },
    { id:'light-sea',    name:'فاتح بحري',      mode:'light', colors:{ bg:'#eff6ff', surface:'#ffffff', brand:'#1d4ed8', accent:'#0ea5e9', text:'#0f172a' } },
    { id:'dark',         name:'داكن (افتراضي)', mode:'dark',  colors:{ bg:'#071311', surface:'#102220', brand:'#14b8a6', accent:'#2dd4bf', text:'#e6fffb' } },
    { id:'dark-blue',    name:'داكن أزرق',      mode:'dark',  colors:{ bg:'#08101d', surface:'#111a2e', brand:'#3b82f6', accent:'#22d3ee', text:'#e6eefc' } },
    { id:'dark-forest',  name:'داكن غابات',     mode:'dark',  colors:{ bg:'#08130d', surface:'#112016', brand:'#22c55e', accent:'#84cc16', text:'#eafff1' } },
  ];
  function themeModeOf(id){
    const t = App.THEMES.find(x=>x.id===id);
    if (t) return t.mode;
    if (id === 'auto') return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    return id === 'dark' ? 'dark' : 'light';
  }
  function themeCard(th, cur){
    const c = th.colors || {};
    const active = th.id === cur ? ' active' : '';
    return '<button type="button" class="pp-theme-card'+active+'" data-th="'+App.esc(th.id)+'" title="'+App.esc(th.name)+'" aria-pressed="'+(th.id===cur)+'">'+
      '<span class="pp-tc-preview" style="--p-bg:'+App.esc(c.bg||'#fff')+';--p-surface:'+App.esc(c.surface||'#fff')+';--p-brand:'+App.esc(c.brand||'#0f766e')+';--p-accent:'+App.esc(c.accent||'#14b8a6')+';--p-text:'+App.esc(c.text||'#111')+'">'+
        '<span class="pp-tc-side"></span>'+
        '<span class="pp-tc-main"><span class="pp-tc-head"></span><span class="pp-tc-line w70"></span><span class="pp-tc-line w45"></span><span class="pp-tc-chips"><i style="background:var(--p-brand)"></i><i style="background:var(--p-accent)"></i><i style="background:var(--p-surface);border:1px solid rgba(128,128,128,.25)"></i></span></span>'+
        '<span class="pp-tc-check">'+App.icon('check', 12)+'</span>'+
      '</span>'+
      '<span class="pp-tc-name">'+App.esc(th.name)+'<span class="pp-tc-mode">'+(th.mode==='dark'?'داكن':'فاتح')+'</span></span>'+
    '</button>';
  }
  App.setTheme = applyTheme;
  App.toggleTheme = function () {
    App.openThemePicker();
  };
  App.openThemePicker = function () {
    const cur = localStorage.getItem('pp_theme') || 'light';
    const lights = App.THEMES.filter(t => t.mode === 'light');
    const darks = App.THEMES.filter(t => t.mode === 'dark');
    const body = '<div class="pp-theme-gallery">'+
      '<section class="pp-tg-group"><div class="pp-tg-head"><span class="pp-tg-dot light"></span><h4>الثيمات الفاتحة</h4><span class="pp-tg-count">'+lights.length+'</span></div><div class="pp-theme-grid">'+lights.map(t=>themeCard(t,cur)).join('')+'</div></section>'+
      '<section class="pp-tg-group"><div class="pp-tg-head"><span class="pp-tg-dot dark"></span><h4>الثيمات الداكنة</h4><span class="pp-tg-count">'+darks.length+'</span></div><div class="pp-theme-grid">'+darks.map(t=>themeCard(t,cur)).join('')+'</div></section>'+
    '</div>';
    const m = ui.modal({ title:'معرض الثيمات', body, footer:'<button class="btn" data-close>إغلاق</button>' });
    m.el.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{
      applyTheme(b.dataset.th);
      m.el.querySelectorAll('[data-th]').forEach(x=>{ const on=x===b; x.classList.toggle('active',on); x.setAttribute('aria-pressed', on?'true':'false'); });
    });
  };


  function renderShell() {
    const u = App.state.user;
    document.getElementById('app').innerHTML = `
      <div class="sidebar-overlay" data-sidebar-overlay></div>
      <div class="app-shell">
        <aside class="sidebar" data-sidebar>
          <div class="brand">
            <div class="brand-logo">${App.icon('pharmacy', 26)}</div>
            <div><div class="brand-name">PharmaPro</div><div class="brand-sub">${App.esc(App.state.settings.pharmacy_name || 'نظام إدارة الصيدلية')}</div></div>
          </div>
          <div class="sidebar-scroll">${navHTML()}</div>
          <div class="sidebar-footer">
            <div class="sidebar-user">
              <div class="avatar sm" style="background:${u.color || 'var(--primary)'}">${App.esc((u.full_name || '?').trim().charAt(0))}</div>
              <div class="meta"><div class="name truncate">${App.esc(u.full_name)}</div><div class="role truncate">${App.esc(u.role_name || '')}</div></div>
              <button class="logout" data-logout title="تسجيل الخروج">${App.icon('logout')}</button>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="icon-btn menu-toggle" data-menu>${App.icon('menu')}</button>
            <div class="topbar-title"><h1 data-page-title>لوحة التحكم</h1><p data-page-sub></p></div>
            <div class="topbar-actions">
              <button class="search-trigger" data-palette>${App.icon('search')}<span>بحث سريع...</span><kbd>Ctrl K</kbd></button>
              <span class="shift-chip closed" data-shift-chip style="cursor:pointer" title="الورديات">${App.icon('clock', 13)} ...</span>
              <button class="icon-btn" data-theme-btn title="معرض الثيمات">${App.icon('palette')}</button>
              <button class="icon-btn" data-notifications title="التنبيهات">${App.icon('bell')}<span class="dot" data-notif-dot style="display:none"></span></button>
              <button class="user-menu" data-profile style="border:1px solid var(--border);background:var(--panel);cursor:pointer">
                <div class="avatar" style="background:${u.color || 'var(--primary)'}">${App.esc((u.full_name || '?').trim().charAt(0))}</div>
                <div class="meta"><span class="name">${App.esc(u.full_name.split(' ').slice(0, 2).join(' '))}</span><span class="role">${App.esc(u.role_name || '')}</span></div>
              </button>
            </div>
          </header>
          <main class="view" id="view"></main>
        </div>
      </div>`;

    document.querySelector('[data-logout]').onclick = () => App.logout();
    document.querySelector('[data-theme-btn]').onclick = App.toggleTheme;
    document.querySelector('[data-menu]').onclick = openSidebar;
    document.querySelector('[data-sidebar-overlay]').onclick = closeSidebar;
    document.querySelector('[data-notifications]').onclick = openNotifications;
    document.querySelector('[data-profile]').onclick = openProfile;
    document.querySelector('[data-palette]').onclick = openPalette;
    document.querySelector('[data-shift-chip]').onclick = () => App.go('shifts');
    document.querySelectorAll('[data-nav]').forEach((a) => a.addEventListener('click', () => closeSidebar()));
  }

  function openSidebar() {
    document.querySelector('[data-sidebar]').classList.add('open');
    document.querySelector('[data-sidebar-overlay]').classList.add('open');
  }
  function closeSidebar() {
    const s = document.querySelector('[data-sidebar]');
    if (s) s.classList.remove('open');
    const o = document.querySelector('[data-sidebar-overlay]');
    if (o) o.classList.remove('open');
  }

  App.go = function (route, params) {
    let hash = '#/' + route;
    if (params && Object.keys(params).length) hash += '?' + new URLSearchParams(params).toString();
    if (location.hash === hash) App.renderRoute();
    else location.hash = hash;
  };

  App.refresh = function () { App.renderRoute(); };

  /* ------------------------------------------------------------ */
  /*                              ROUTER                          */
  /* ------------------------------------------------------------ */
  App.register = function (id, def) { App.views[id] = def; };

  let currentCleanup = null;

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [route, qs] = raw.split('?');
    return { route: route || 'dashboard', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  }

  App.renderRoute = async function () {
    if (!App.state.user) return;
    const { route, params } = parseHash();
    const view = App.views[route];
    const container = document.getElementById('view');
    if (!container) return;
    if (currentCleanup) { try { currentCleanup(); } catch (_) { /* ignore */ } currentCleanup = null; }

    if (!view) {
      container.innerHTML = ui.empty({ icon: 'info', title: 'الصفحة غير موجودة', text: 'اختر صفحة من القائمة الجانبية.' });
      return;
    }
    if (view.perm && !App.can(view.perm)) {
      container.innerHTML = ui.empty({ icon: 'shield', title: 'غير مصرح لك بالوصول', text: 'هذه الصفحة تتطلب صلاحية لا يملكها حسابك الحالي. تواصل مع مدير النظام.' });
      return;
    }

    App.state.currentRoute = route;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === route));
    const titleEl = document.querySelector('[data-page-title]');
    const subEl = document.querySelector('[data-page-sub]');
    if (titleEl) titleEl.textContent = view.title || '';
    if (subEl) subEl.textContent = view.subtitle || '';
    document.title = `${view.title || ''} · PharmaPro`;
    window.scrollTo({ top: 0, behavior: 'instant' });

    container.innerHTML = `<div class="loading-block"><span class="spinner lg"></span><span>جارٍ تحميل ${view.title || ''}...</span></div>`;
    try {
      const cleanup = await view.render(container, params);
      if (typeof cleanup === 'function') currentCleanup = cleanup;
    } catch (err) {
      console.error(err);
      if (err.status === 403 || err.status === 401) {
        container.innerHTML = ui.empty({ icon: 'shield', title: 'تعذر فتح الصفحة', text: App.esc(err.message) });
      } else {
        container.innerHTML = `<div class="card card-pad">${ui.empty({
          icon: 'alert', title: 'حدث خطأ أثناء تحميل الصفحة', text: App.esc(err.message || ''),
          action: `<button class="btn primary mt-3" onclick="App.refresh()">${App.icon('refresh')} إعادة المحاولة</button>`
        })}</div>`;
      }
    }
    closeSidebar();
  };

  window.addEventListener('hashchange', App.renderRoute);

  /* ------------------------------------------------------------ */
  /*                         NOTIFICATIONS                        */
  /* ------------------------------------------------------------ */
  function openNotifications() {
    const n = App.state.notifications || {};
    const low = n.low_stock || [];
    const exp = n.expiring || [];
    const shift = n.shift;
    const section = (title, icon, items, tone, emptyText) => `
      <div style="margin-bottom:16px">
        <div class="flex items-center gap-2 mb-2"><span style="color:${tone}">${App.icon(icon, 16)}</span><b style="font-size:12.5px">${title}</b></div>
        ${items.length ? items.map((it) => `<div class="alert-item" style="padding:9px 0;border-color:var(--border)">${it}</div>`).join('') : `<div class="small muted" style="padding:6px 0">${emptyText}</div>`}
      </div>`;
    const body = `
      ${section('أصناف تحت حد الطلب', 'alert', low.map((p) => `
        <div style="display:flex;width:100%;gap:8px"><div style="flex:1"><div style="font-weight:600;font-size:12px">${App.esc(p.name)}</div>
        <div class="xsmall muted">المتاح ${fmt.qty(p.stock)} ${App.esc(p.unit || '')} · الحد ${fmt.qty(p.min_stock)}</div></div>
        <span class="badge warning">${fmt.qty(p.stock)}</span></div>`), 'var(--warning)', 'لا توجد أصناف منخفضة')}
      ${section('دفعات قاربت على الانتهاء', 'clock', exp.map((b) => `
        <div style="display:flex;width:100%;gap:8px"><div style="flex:1"><div style="font-weight:600;font-size:12px">${App.esc(b.name)}</div>
        <div class="xsmall muted">${b.days_left < 0 ? 'منتهية' : 'تنتهي بعد ' + b.days_left + ' يوم'} · ${App.esc(b.batch_no || '')}</div></div>
        <span class="badge ${b.days_left < 0 ? 'danger' : 'warning'}">${fmt.qty(b.qty)}</span></div>`), 'var(--danger)', 'لا توجد دفعات قريبة الانتهاء')}
      <div class="alert-item" style="padding:10px 0;border-color:var(--border)">
        <div class="ai-icon" style="background:var(--primary-soft);color:var(--primary)">${App.icon('clock', 16)}</div>
        <div class="ai-main"><div class="ai-title">${shift ? 'وردية مفتوحة الآن' : 'لا توجد وردية مفتوحة'}</div>
        <div class="ai-sub">${shift ? 'بدأت ' + fmt.datetime(shift.opened_at) : 'افتح وردية لبدء البيع'}</div></div>
        <button class="btn sm" onclick="App.go('shifts')">عرض</button>
      </div>
      <div class="alert-item" style="padding:10px 0">
        <div class="ai-icon" style="background:var(--purple-soft);color:var(--purple)">${App.icon('clipboard', 16)}</div>
        <div class="ai-main"><div class="ai-title">روشتات قيد الصرف</div><div class="ai-sub">${n.pending_rx || 0} روشتة بانتظار الصرف</div></div>
        <button class="btn sm" onclick="App.go('prescriptions')">عرض</button>
      </div>`;
    ui.drawer({
      title: 'التنبيهات والإشعارات', body,
      onMount: (h) => {
        h.body.querySelectorAll('.alert-item button').forEach((b) => b.addEventListener('click', () => h.close()));
      }
    });
  }

  /* ------------------------------------------------------------ */
  /*                          COMMAND PALETTE                     */
  /* ------------------------------------------------------------ */
  function openPalette() {
    const m = ui.modal({
      title: '', size: 'md', closeOnBackdrop: true,
      body: `<div class="pal-input">${App.icon('search')}<input class="pal-input-el" placeholder="ابحث عن صفحة، صنف، عميل، أو فاتورة..." autocomplete="off">
          <kbd class="xsmall muted">ESC</kbd></div>
        <div class="pal-results"><div class="pal-section">التنقل السريع</div>
          ${NAV.flatMap((g) => g.items).filter((it) => App.can(it.perm)).map((it) => `
            <div class="pal-item" data-navto="${it.id}">${App.icon(it.icon)}<span>${it.label}</span>
            <span class="sub">${it.id === 'pos' ? 'F2' : ''}</span></div>`).join('')}
        </div>
        <div class="pal-foot"><span>↑↓ للتنقل</span><span>Enter للفتح</span><span>Ctrl+K للإغلاق</span></div>`,
      onMount: (h) => {
        h.el.querySelector('.modal-head').style.display = 'none';
        h.el.style.marginTop = '0';
        const input = h.el.querySelector('.pal-input-el');
        const results = h.el.querySelector('.pal-results');
        let items = [];
        let active = 0;
        const render = () => {
          results.querySelectorAll('.pal-item').forEach((el, i) => el.classList.toggle('active', i === active));
        };
        const bindNav = () => {
          results.querySelectorAll('[data-navto]').forEach((el) => {
            el.onclick = () => { h.close(); App.go(el.dataset.navto); };
          });
          items = [...results.querySelectorAll('.pal-item')];
          if (active >= items.length) active = 0;
          render();
        };
        bindNav();
        input.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(items.length - 1, active + 1); render(); items[active] && items[active].scrollIntoView({ block: 'nearest' }); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); render(); items[active] && items[active].scrollIntoView({ block: 'nearest' }); }
          else if (e.key === 'Enter') { e.preventDefault(); items[active] && items[active].click(); }
        });
        const search = App.debounce(async () => {
          const q = input.value.trim();
          if (!q) { h.close(); openPalette(); return; }
          try {
            const r = await App.api('/search?q=' + encodeURIComponent(q));
            const sections = [];
            if (r.products.length) sections.push(`<div class="pal-section">الأصناف</div>${r.products.map((p) => `
              <div class="pal-item" data-prod="${p.id}">${App.icon('pill')}<span>${App.esc(p.name)}</span><span class="sub">${fmt.money(p.price)} · مخزون ${fmt.qty(p.stock)}</span></div>`).join('')}`);
            if (r.customers.length) sections.push(`<div class="pal-section">العملاء</div>${r.customers.map((c) => `
              <div class="pal-item" data-cust="${c.id}">${App.icon('user')}<span>${App.esc(c.name)}</span><span class="sub">${App.esc(c.phone || '')}</span></div>`).join('')}`);
            if (r.invoices.length) sections.push(`<div class="pal-section">الفواتير</div>${r.invoices.map((s) => `
              <div class="pal-item" data-inv="${s.id}">${App.icon('receipt')}<span>${App.esc(s.invoice_no)}</span><span class="sub">${fmt.date(s.date)} · ${fmt.money(s.total)}</span></div>`).join('')}`);
            if (!sections.length) sections.push(`<div class="empty" style="padding:24px"><div class="icon-wrap">${App.icon('search', 26)}</div><h4>لا توجد نتائج</h4><p>جرّب كلمة بحث أخرى</p></div>`);
            results.innerHTML = `<div class="pal-section">نتائج البحث</div>` + sections.join('');
            results.querySelectorAll('[data-prod]').forEach((el) => el.onclick = () => { h.close(); App.go('products', { search: q }); });
            results.querySelectorAll('[data-cust]').forEach((el) => el.onclick = () => { h.close(); App.go('customers', { search: q }); });
            results.querySelectorAll('[data-inv]').forEach((el) => el.onclick = () => { h.close(); App.go('sales', { search: q }); });
            bindNav();
          } catch (_) { /* ignore */ }
        }, 220);
        input.addEventListener('input', search);
      }
    });
  }

  function openProfile() {
    const u = App.state.user;
    const body = `
      <div class="flex items-center gap-3 mb-4">
        <div class="avatar lg" style="background:${u.color || 'var(--primary)'}">${App.esc(u.full_name.charAt(0))}</div>
        <div><div class="bold" style="font-size:16px">${App.esc(u.full_name)}</div>
        <div class="small muted">${App.esc(u.role_name || '')} · @${App.esc(u.username)}</div></div>
      </div>
      <div class="info-row"><span class="k">الهاتف</span><span class="v">${App.esc(u.phone || '—')}</span></div>
      <div class="info-row"><span class="k">البريد الإلكتروني</span><span class="v">${App.esc(u.email || '—')}</span></div>
      <div class="info-row"><span class="k">آخر دخول</span><span class="v">${fmt.datetime(u.last_login)}</span></div>
      <hr class="hr">
      <h4 class="mb-3" style="font-size:13px">تغيير كلمة المرور</h4>
      <div class="field mb-3"><label class="label">كلمة المرور الحالية</label><input class="input" type="password" data-cur></div>
      <div class="field mb-3"><label class="label">كلمة المرور الجديدة</label><input class="input" type="password" data-new></div>
      <div class="field"><label class="label">تأكيد كلمة المرور</label><input class="input" type="password" data-conf></div>`;
    const m = ui.modal({
      title: 'الحساب الشخصي', size: 'sm', body,
      footer: `<button class="btn ghost" data-logout2>${App.icon('logout')} تسجيل الخروج</button>
        <button class="btn primary" data-save>${App.icon('save')} حفظ</button>`,
      onMount: (h) => {
        h.el.querySelector('[data-logout2]').onclick = () => { m.close(); App.logout(); };
        h.el.querySelector('[data-save]').onclick = async () => {
          const cur = h.el.querySelector('[data-cur]').value;
          const nw = h.el.querySelector('[data-new]').value;
          const cf = h.el.querySelector('[data-conf]').value;
          if (nw && nw !== cf) return ui.toast('كلمتا المرور غير متطابقتين', 'error');
          if (!nw) return ui.toast('أدخل كلمة المرور الجديدة', 'warning');
          try {
            await App.api('/auth/password', { method: 'POST', body: { current: cur, next: nw } });
            ui.toast('تم تغيير كلمة المرور بنجاح');
            m.close();
          } catch (e) { ui.toast(e.message, 'error'); }
        };
      }
    });
  }

  /* ------------------------------------------------------------ */
  /*                              LOGIN                           */
  /* ------------------------------------------------------------ */
  function renderLogin(errorMsg) {
    const info = App.state.publicInfo || {};
    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="login-wrap">
        <div class="login-art">
          <div class="brand"><div class="brand-logo">${App.icon('pharmacy', 28)}</div>
            <div><div class="brand-name">PharmaPro</div><div class="brand-sub">PHARMACY MANAGEMENT SUITE</div></div></div>
          <div class="hero">
            <h1>صيدليتك في <span>مكان واحد</span><br>بكل احترافية</h1>
            <p>منصة متكاملة لإدارة الصيدلية: نقطة بيع ذكية، مخزون ودفعات وصلاحية، مشتريات وموردون، روشتات، محاسبة شاملة، تقارير، ورديات، نسخ احتياطي، وصلاحيات مستخدمين — بواجهة عصرية تعمل على كل الأجهزة.</p>
            <div class="login-features">
              <div class="login-feature">${App.icon('cart')} كاشير سريع وباركود</div>
              <div class="login-feature">${App.icon('layers')} تتبع الدفعات والصلاحية</div>
              <div class="login-feature">${App.icon('wallet')} محاسبة ERP متكاملة</div>
              <div class="login-feature">${App.icon('database')} نسخ احتياطي واستعادة</div>
              <div class="login-feature">${App.icon('shield')} صلاحيات وأدوار مرنة</div>
              <div class="login-feature">${App.icon('chart')} تقارير وتحليلات ذكية</div>
            </div>
          </div>
          <div class="foot"><span>© ${new Date().getFullYear()} PharmaPro · v${App.version}</span><span>بياناتك محفوظة على جهازك</span></div>
        </div>
        <div class="login-panel">
          <div class="login-card">
            <div class="flex items-center gap-3 mb-4" style="display:none">${App.icon('plus')}</div>
            <h2>مرحباً بعودتك 👋</h2>
            <p class="sub">سجّل الدخول إلى ${App.esc(info.pharmacy_name || 'صيدليتك')} لمتابعة يومك.</p>
            ${errorMsg ? `<div class="login-error">${App.esc(errorMsg)}</div>` : ''}
            <form data-login>
              <div class="field"><label class="label">اسم المستخدم</label>
                <input class="input" name="username" placeholder="admin" autocomplete="username" required></div>
              <div class="field"><label class="label">كلمة المرور</label>
                <div class="pw-wrap"><input class="input" name="password" type="password" placeholder="••••••••" autocomplete="current-password" required>
                <button type="button" class="eye" data-eye>${App.icon('eye')}</button></div></div>
              <button class="btn primary w-full" type="submit" style="height:48px;font-size:14.5px">${App.icon('arrowLeft')} تسجيل الدخول</button>
            </form>
            <div class="demo-box">
              <div class="t">${App.icon('info', 13)} حسابات تجريبية للدخول السريع</div>
              <div class="demo-chips">
                <button class="demo-chip" data-demo="admin|admin123"><b>مدير النظام</b> admin</button>
                <button class="demo-chip" data-demo="pharmacist|pharma123"><b>صيدلي</b> pharmacist</button>
                <button class="demo-chip" data-demo="cashier|cashier123"><b>كاشير</b> cashier</button>
                <button class="demo-chip" data-demo="accountant|acc123"><b>محاسب</b> accountant</button>
              </div>
            </div>
            <div class="xsmall muted mt-4" style="text-align:center">حساب مدير النظام: <b>admin / admin123</b> · باقي الحسابات: انظر الأعلى</div>
          </div>
        </div>
      </div>`;

    const form = app.querySelector('[data-login]');
    const eye = app.querySelector('[data-eye]');
    eye.onclick = () => {
      const pw = form.password;
      pw.type = pw.type === 'password' ? 'text' : 'password';
      eye.innerHTML = App.icon(pw.type === 'password' ? 'eye' : 'x');
    };
    app.querySelectorAll('[data-demo]').forEach((btn) => {
      btn.onclick = () => {
        const [u, p] = btn.dataset.demo.split('|');
        form.username.value = u;
        form.password.value = p;
        form.username.focus();
      };
    });
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      submit.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> جارٍ الدخول...`;
      try {
        const res = await App.api('/auth/login', {
          method: 'POST', auth: false,
          body: { username: form.username.value.trim(), password: form.password.value }
        });
        localStorage.setItem('pp_token', res.token);
        App.state.user = res.user;
        await bootApp();
      } catch (err) {
        submit.disabled = false;
        submit.innerHTML = `${App.icon('arrowLeft')} تسجيل الدخول`;
        renderLogin(err.message);
      }
    };
    setTimeout(() => form.username.focus(), 100);
  }

  /* ------------------------------------------------------------ */
  /*                              BOOT                            */
  /* ------------------------------------------------------------ */
  async function bootApp() {
    await loadSettings();
    renderShell();
    applyTheme(localStorage.getItem('pp_theme') || 'light');
    await loadNotifications();
    await App.renderRoute();
    if (!location.hash) location.hash = '#/dashboard';
  }

  App.init = async function () {
    applyTheme(localStorage.getItem('pp_theme') || 'light');
    try { App.state.publicInfo = await App.api('/public', { auth: false }); } catch (_) { }
    if (!App.token()) return renderLogin();

    document.getElementById('app').innerHTML = `<div style="min-height:100vh;display:grid;place-items:center">
      <div style="text-align:center"><div class="spinner lg" style="margin:0 auto 12px"></div><div class="muted">جارٍ تهيئة النظام...</div></div></div>`;
    try {
      App.state.user = await App.api('/auth/me');
      await bootApp();
      setInterval(loadNotifications, 120000);
    } catch (err) {
      if (err.status === 401) { localStorage.removeItem('pp_token'); renderLogin(); }
      else renderLogin(err.message);
    }
  };

  document.addEventListener('DOMContentLoaded', App.init);
})();
