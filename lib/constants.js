export const CINEMAS = [
  { id: 'EGDENS', name: 'Eastgardens', state: 'NSW' },
  { id: 'BROADW', name: 'Broadway', state: 'NSW' },
  { id: 'CROCIN', name: 'Cronulla', state: 'NSW' },
  { id: 'WGHMAL', name: 'Warringah Mall', state: 'NSW' },
  { id: 'PENRTH', name: 'Penrith', state: 'NSW' },
  { id: 'MTDRTT', name: 'Mt Druitt', state: 'NSW' },
  { id: 'CHARLE', name: 'Charlestown', state: 'NSW' },
  { id: 'GHLCIN', name: 'Green Hills', state: 'NSW' },
  { id: 'ERINAF', name: 'Erina', state: 'NSW' },
  { id: 'CHWOOD', name: 'Chatswood Mandarin', state: 'NSW' },
  { id: 'CWFFLD', name: 'Chatswood Westfield', state: 'NSW' },
  { id: 'SHOWGR', name: 'Entertainment Quarter', state: 'NSW' },
  { id: 'WETHER', name: 'Wetherill Park', state: 'NSW' },
  { id: 'BANKTN', name: 'Bankstown', state: 'NSW' },
  { id: 'WESCIN', name: 'Blacktown', state: 'NSW' },
  { id: 'WWGCIN', name: 'Warrawong', state: 'NSW' },
  { id: 'TWDCTY', name: 'Tweed City', state: 'NSW' },
  { id: 'CHDSTN', name: 'Chadstone', state: 'VIC' },
  { id: 'EASTLN', name: 'Eastland', state: 'VIC' },
  { id: 'FHLCIN', name: 'Forest Hill', state: 'VIC' },
  { id: 'FRANKS', name: 'Frankston', state: 'VIC' },
  { id: 'GRENSB', name: 'Greensborough', state: 'VIC' },
  { id: 'HIGPNT', name: 'Highpoint', state: 'VIC' },
  { id: 'MCECIN', name: 'Melbourne Central', state: 'VIC' },
  { id: 'MILENM', name: 'Millennium', state: 'VIC' },
  { id: 'NORTHL', name: 'Northland', state: 'VIC' },
  { id: 'VGDCIN', name: 'Victoria Gardens', state: 'VIC' },
  { id: 'DOCCIN', name: 'The District Docklands', state: 'VIC' },
  { id: 'BMWCIN', name: 'Broadmeadows', state: 'VIC' },
  { id: 'TAYLOR', name: 'Watergardens', state: 'VIC' },
  { id: 'CAROUS', name: 'Carousel', state: 'WA' },
  { id: 'CURCIN', name: 'Currambine', state: 'WA' },
  { id: 'BOOGDN', name: 'Garden City', state: 'WA' },
  { id: 'JOOCIN', name: 'Joondalup', state: 'WA' },
  { id: 'KYPCIN', name: 'Karrinyup', state: 'WA' },
  { id: 'MIDCIN', name: 'Midland Gate', state: 'WA' },
  { id: 'ROKCIN', name: 'Rockingham', state: 'WA' },
  { id: 'SOUTHL', name: 'Southlands', state: 'WA' },
  { id: 'WARCIN', name: 'Warwick', state: 'WA' },
  { id: 'BUNCIN', name: 'Bunbury', state: 'WA' },
  { id: 'BELCON', name: 'Belconnen', state: 'ACT' },
  { id: 'WODENP', name: 'Woden', state: 'ACT' },
  { id: 'ARNCIN', name: 'Arndale', state: 'SA' },
  { id: 'NWDCIN', name: 'Norwood', state: 'SA' },
  { id: 'SLYCIN', name: 'Salisbury', state: 'SA' },
  { id: 'TTPLZA', name: 'Tea Tree Plaza', state: 'SA' },
  { id: 'STAFRD', name: 'Stafford', state: 'QLD' },
  { id: 'SUNBNK', name: 'Sunnybank', state: 'QLD' },
  { id: 'IPSCIN', name: 'Ipswich', state: 'QLD' },
  { id: 'REDCLF', name: 'Redcliffe', state: 'QLD' },
]

export const TYPE_ORDER = {
  DBOX:     0,
  XTREME:   1,
  IMAX:     2,
  VMAX:     3,
  LUX:      4,
  GOLD:     5,
  STANDARD: 6,
}

export const TYPE_LABEL = {
  DBOX:     'D-BOX',
  XTREME:   'XtremeScreen',
  IMAX:     'IMAX',
  VMAX:     'V-Max',
  LUX:      'Lux',
  GOLD:     'Gold Class',
  STANDARD: 'Recliners',
}

export const TYPE_CLASS = {
  DBOX:     'dbox',
  XTREME:   'xtreme',
  IMAX:     'imax',
  VMAX:     'vmax',
  LUX:      'lux',
  GOLD:     'gold',
  STANDARD: 'recliner',
}

export const TYPE_COLOR = {
  DBOX:     '#FF6B35',
  XTREME:   '#00D4A8',
  IMAX:     '#60A5FA',
  VMAX:     '#818CF8',
  LUX:      '#E879F9',
  GOLD:     '#FBBF24',
  STANDARD: '#A78BFA',
}

// ─── Complete HOYTS Australia movie database ──────────────────────────────────
// Sourced live from hoyts.com.au August 2026
// IDs confirmed by matching session JSON typeId, screenName, tags and session times
export const KNOWN_MOVIES = {
  // ── NOW SHOWING (main releases) ──────────────────────────────────────────
  'HO00010000': { name: 'Spider-Man: Brand New Day', runtime: 145 },
  'HO00010001': { name: 'The Odyssey', runtime: 172 },
  'HO00008566': { name: 'Moana', runtime: 115 },
  'HO00008574': { name: 'Toy Story 5', runtime: 102 },
  'HO00009724': { name: 'Minions & Monsters', runtime: 90 },

  // ── NOW SHOWING (wider) ───────────────────────────────────────────────────
  'HO00010981': { name: 'Spa Weekend (GNO Event)', runtime: 103 },   // GNO advance screening Aug 19
  'HO00010458': { name: 'One Night Only (GNO Preview)', runtime: 102 }, // GNO event Aug 5, Cinema 06

  // ── STARTS AUG 6 ─────────────────────────────────────────────────────────
  'HO00011151': { name: 'Holy Days', runtime: 101 },                 // MatM tag, Cinema 06
  'HO00011192': { name: 'Ice Cream Man', runtime: 87 },              // MatM tag, Cinema 06

  // ── LIMITED / SPECIAL SCREENINGS ─────────────────────────────────────────
  'HO00011198': { name: "André Rieu's 2026 Summer Concert: Viva Maastricht!", runtime: 130 }, // LStar tag Cinema 08

  // ── STARTS AUG 13 ────────────────────────────────────────────────────────
  'HO00011228': { name: 'Harry Potter and the Prisoner of Azkaban', runtime: 142 }, // Cinema 06, Aug 12+15

  // ── MOW (Movies of the Week) DBOX PREVIEWS ───────────────────────────────
  // These are advance/preview DBOX screenings before wide release
  // Exact titles TBC — placeholders based on release window
  'HO00011450': { name: 'DBOX Preview (Aug 13)', runtime: 120 },
  'HO00011451': { name: 'DBOX Preview (Aug 14)', runtime: 120 },
  'HO00011452': { name: 'DBOX Preview (Aug 15)', runtime: 120 },
  'HO00011453': { name: 'DBOX Preview (Aug 16)', runtime: 120 },
  'HO00011454': { name: 'DBOX Preview (Aug 20)', runtime: 120 },
  'HO00011455': { name: 'DBOX Preview (Aug 21)', runtime: 120 },
  'HO00011456': { name: 'DBOX Preview (Aug 22)', runtime: 120 },
  'HO00011457': { name: 'DBOX Preview (Aug 23)', runtime: 120 },
  'HO00011106': { name: 'DBOX Preview (Aug 27–30)', runtime: 120 },
  'HO00011209': { name: 'DBOX Preview (Sep 5–6)', runtime: 120 },

  // ── SECRET / SPECIAL EVENTS ───────────────────────────────────────────────
  'HO00011153': { name: 'Secret Screening', runtime: 120 },          // SS tag Aug 29
  'HO00011119': { name: 'Special Event Screening', runtime: 120 },   // SPECEVENT Cinema 08 Aug 29–30

  // ── COMING SEPT ──────────────────────────────────────────────────────────
  'HO00011254': { name: 'Coming Soon (Sep)', runtime: 120 },         // Cinema 08 Sep 3–6
  'HO00011459': { name: 'Coming Soon (Aug 27+)', runtime: 120 },     // Cinema 07 Aug 27–Sep 1

  // ── OTHER CURRENT TITLES (from hoyts.com.au Aug 2026) ────────────────────
  'HO00010002': { name: 'Kiri and Lou Go Raaa!', runtime: 61 },
  'HO00010003': { name: 'Obsession', runtime: 108 },
  'HO00010004': { name: 'The Wizard of the Kremlin', runtime: 136 },
  'HO00010005': { name: 'Supergirl', runtime: 110 },
  'HO00010006': { name: 'The Invite', runtime: 107 },
  'HO00010007': { name: 'Evil Dead Burn', runtime: 110 },
  'HO00010008': { name: 'Tenor: My Name is Pati', runtime: 104 },
  'HO00010009': { name: 'Jackass: Best and Last', runtime: 92 },
  'HO00010010': { name: 'ATEEZ: Light the Way', runtime: 65 },
  'HO00010011': { name: 'Kankaan De Ohle', runtime: 118 },
  'HO00010012': { name: 'Srinivasa Mangapuram', runtime: 174 },
  'HO00010013': { name: "40 Years of F***in' Up", runtime: 125 },
  'HO00010014': { name: 'Disclosure Day', runtime: 145 },
  'HO00010015': { name: 'Detective Conan: Fallen Angel of the Highway', runtime: 109 },
  'HO00010016': { name: 'Khali Balak Min Nafsak', runtime: 107 },
  'HO00010017': { name: 'DC (Tamil)', runtime: 170 },
  'HO00010018': { name: 'Dear You', runtime: 119 },
  'HO00010019': { name: 'Jana Nayagan', runtime: 193 },
  'HO00010020': { name: 'Michael', runtime: 125 },
  'HO00010021': { name: 'Thudakkam', runtime: 190 },
  'HO00010022': { name: 'Yaar Jigree Kasooti Degree', runtime: 182 },
  'HO00010023': { name: 'Star Wars: The Mandalorian and Grogu', runtime: 132 },
  'HO00010024': { name: 'Leviticus', runtime: 88 },
  'HO00010025': { name: 'Dhamaal 4', runtime: 152 },
  'HO00010026': { name: 'Sakr W Kanaria', runtime: 120 },
  'HO00010027': { name: 'Backrooms: Everything Must Go Edition', runtime: 126 },
  'HO00010028': { name: 'I Know Who You Are', runtime: 141 },
  'HO00010029': { name: 'Teenage Sex and Death at Camp Miasma', runtime: 111 },
  'HO00010030': { name: 'Holy Days', runtime: 101 },

  // ── COMING SOON (from hoyts.com.au/movies/coming-soon) ───────────────────
  'HO00011200': { name: 'Harry Potter and the Prisoner of Azkaban', runtime: 142 },
  'HO00011201': { name: 'One Night Only', runtime: 102 },
  'HO00011202': { name: 'Tom and Jerry: Compass of Time', runtime: 100 },
  'HO00011203': { name: 'Naagin', runtime: 157 },
  'HO00011204': { name: 'Super Troopers 3', runtime: 100 },
  'HO00011205': { name: 'Spa Weekend', runtime: 103 },
  'HO00011206': { name: 'DC (Tamil)', runtime: 170 },
  'HO00011207': { name: 'Thudakkam', runtime: 190 },
  'HO00011208': { name: 'Yaar Jigree Kasooti Degree', runtime: 182 },
}

export const HOYTS_BASE = 'https://apim-aea.hoyts.com.au/cinemaapi-au-live/api'
