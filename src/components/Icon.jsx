const paths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
  crowns: <><ellipse cx="9" cy="6" rx="6" ry="2.5" /><path d="M3 6v4c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6M3 10v4c0 1.4 2.7 2.5 6 2.5 1.1 0 2.1-.1 3-.4" /><ellipse cx="16" cy="16" rx="5" ry="2.2" /><path d="M11 16v3c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2v-3" /></>,
  currencies: <><g transform="translate(-0.5 5) scale(.58)"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" /><path d="M7 12h5M15 9.4a4 4 0 1 0 0 5.2" /></g><g transform="translate(10.5 5) scale(.58)"><circle cx="12" cy="12" r="10" /><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 18V6" /></g></>,
  bitcoin: <><circle cx="12" cy="12" r="9" /><path d="M9 7.5h4.2a2.3 2.3 0 0 1 0 4.5H9m0 0h4.8a2.3 2.3 0 0 1 0 4.5H9M11 5v2.5m3-2v2.6M11 16.5V19m3-2.5V19M9 7v10" /></>,
  chart: <><path d="M4 19V5M4 19h16" /><path d="m7 15 4-4 3 2 5-6" /></>,
  gold: <path fill="currentColor" stroke="none" d="M1 22 2.5 17h7L11 22H1m12 0 1.5-5h7l1.5 5H13M6 15l1.5-5h7l1.5 5H6M23 6.05l-3.86 1.09L18.05 11l-1.09-3.86-3.86-1.09 3.86-1.09 1.09-3.86 1.09 3.86L23 6.05Z" />,
  building: <><path d="M5 21V4h10v17M3 21h18M8 8h1m3 0h1m-5 4h1m3 0h1m-5 4h1m3 0h1" /></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M5 14v5h14v-5" /></>,
  pen: <><path d="m4 20 4.2-1 10.9-10.9a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z" /><path d="m14.8 6.8 2.8 2.8" /></>,
  sparkles: <><path d="m12 3 1.3 3.7L17 8l-3.7 1.3L12 13l-1.3-3.7L7 8l3.7-1.3L12 3Z" /><path d="m5 14 .8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14Zm13-2 .6 1.4L20 14l-1.4.6L18 16l-.6-1.4L16 14l1.4-.6L18 12Z" /></>,
  shield: <><path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  percent: <><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>,
}

export default function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}
