// UK job boards (Reed and others) often give only a postcode, e.g. "B375DP". People search by town, so a postcode-only
// location is shown and matched as its postcode area's main town: "Birmingham, B37 5DP".
const AREAS: Record<string, string> = {
  AB: "Aberdeen", AL: "St Albans", B: "Birmingham", BA: "Bath", BB: "Blackburn", BD: "Bradford", BH: "Bournemouth", BL: "Bolton",
  BN: "Brighton", BR: "Bromley", BS: "Bristol", BT: "Belfast", CA: "Carlisle", CB: "Cambridge", CF: "Cardiff", CH: "Chester",
  CM: "Chelmsford", CO: "Colchester", CR: "Croydon", CT: "Canterbury", CV: "Coventry", CW: "Crewe", DA: "Dartford", DD: "Dundee",
  DE: "Derby", DG: "Dumfries", DH: "Durham", DL: "Darlington", DN: "Doncaster", DT: "Dorchester", DY: "Dudley", E: "London",
  EC: "London", EH: "Edinburgh", EN: "Enfield", EX: "Exeter", FK: "Falkirk", FY: "Blackpool", G: "Glasgow", GL: "Gloucester",
  GU: "Guildford", HA: "Harrow", HD: "Huddersfield", HG: "Harrogate", HP: "Hemel Hempstead", HR: "Hereford", HS: "Outer Hebrides",
  HU: "Hull", HX: "Halifax", IG: "Ilford", IP: "Ipswich", IV: "Inverness", KA: "Kilmarnock", KT: "Kingston upon Thames",
  KW: "Kirkwall", KY: "Kirkcaldy", L: "Liverpool", LA: "Lancaster", LD: "Llandrindod Wells", LE: "Leicester", LL: "Llandudno",
  LN: "Lincoln", LS: "Leeds", LU: "Luton", M: "Manchester", ME: "Rochester", MK: "Milton Keynes", ML: "Motherwell", N: "London",
  NE: "Newcastle upon Tyne", NG: "Nottingham", NN: "Northampton", NP: "Newport", NR: "Norwich", NW: "London", OL: "Oldham",
  OX: "Oxford", PA: "Paisley", PE: "Peterborough", PH: "Perth", PL: "Plymouth", PO: "Portsmouth", PR: "Preston", RG: "Reading",
  RH: "Redhill", RM: "Romford", S: "Sheffield", SA: "Swansea", SE: "London", SG: "Stevenage", SK: "Stockport", SL: "Slough",
  SM: "Sutton", SN: "Swindon", SO: "Southampton", SP: "Salisbury", SR: "Sunderland", SS: "Southend-on-Sea", ST: "Stoke-on-Trent",
  SW: "London", SY: "Shrewsbury", TA: "Taunton", TD: "Galashiels", TF: "Telford", TN: "Tonbridge", TQ: "Torquay", TR: "Truro",
  TS: "Middlesbrough", TW: "Twickenham", UB: "Southall", W: "London", WA: "Warrington", WC: "London", WD: "Watford",
  WF: "Wakefield", WN: "Wigan", WR: "Worcester", WS: "Walsall", WV: "Wolverhampton", YO: "York", ZE: "Lerwick",
};
const POSTCODE = /^([A-Z]{1,2})(\d[A-Z\d]?)\s*(\d[A-Z]{2})$/;
/** "B375DP" -> "Birmingham, B37 5DP"; anything that is not a bare UK postcode is returned unchanged. */
export function ukTownFromPostcode(location: string | null | undefined): string | null | undefined {
  const m = POSTCODE.exec(String(location || "").trim().toUpperCase());
  if (!m) return location;
  const town = AREAS[m[1]];
  return town ? `${town}, ${m[1]}${m[2]} ${m[3]}` : location;
}
