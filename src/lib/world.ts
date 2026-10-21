// Every country a user can target or live in: ISO 3166 code, English name, CV region, currency and main time zone.
// The main target countries have hand-written CV rules in countries.ts; every other country gets its region's rules.

export type Region = "NA" | "EU" | "DACH" | "EE" | "GULF" | "MENA" | "SAS" | "SEA" | "EAS" | "OCE" | "AFR" | "LAT";

// code|name|region|currency|timeZone
const RAW = `AF|Afghanistan|SAS|AFN|Asia/Kabul
AL|Albania|EE|ALL|Europe/Tirane
DZ|Algeria|MENA|DZD|Africa/Algiers
AD|Andorra|EU|EUR|Europe/Andorra
AO|Angola|AFR|AOA|Africa/Luanda
AG|Antigua and Barbuda|LAT|XCD|America/Antigua
AR|Argentina|LAT|ARS|America/Argentina/Buenos_Aires
AM|Armenia|EE|AMD|Asia/Yerevan
AU|Australia|OCE|AUD|Australia/Sydney
AT|Austria|DACH|EUR|Europe/Vienna
AZ|Azerbaijan|EE|AZN|Asia/Baku
BS|Bahamas|LAT|BSD|America/Nassau
BH|Bahrain|GULF|BHD|Asia/Bahrain
BD|Bangladesh|SAS|BDT|Asia/Dhaka
BB|Barbados|LAT|BBD|America/Barbados
BY|Belarus|EE|BYN|Europe/Minsk
BE|Belgium|EU|EUR|Europe/Brussels
BZ|Belize|LAT|BZD|America/Belize
BJ|Benin|AFR|XOF|Africa/Porto-Novo
BT|Bhutan|SAS|BTN|Asia/Thimphu
BO|Bolivia|LAT|BOB|America/La_Paz
BA|Bosnia and Herzegovina|EE|BAM|Europe/Sarajevo
BW|Botswana|AFR|BWP|Africa/Gaborone
BR|Brazil|LAT|BRL|America/Sao_Paulo
BN|Brunei|SEA|BND|Asia/Brunei
BG|Bulgaria|EE|BGN|Europe/Sofia
BF|Burkina Faso|AFR|XOF|Africa/Ouagadougou
BI|Burundi|AFR|BIF|Africa/Bujumbura
CV|Cabo Verde|AFR|CVE|Atlantic/Cape_Verde
KH|Cambodia|SEA|KHR|Asia/Phnom_Penh
CM|Cameroon|AFR|XAF|Africa/Douala
CA|Canada|NA|CAD|America/Toronto
CF|Central African Republic|AFR|XAF|Africa/Bangui
TD|Chad|AFR|XAF|Africa/Ndjamena
CL|Chile|LAT|CLP|America/Santiago
CN|China|EAS|CNY|Asia/Shanghai
CO|Colombia|LAT|COP|America/Bogota
KM|Comoros|AFR|KMF|Indian/Comoro
CG|Congo|AFR|XAF|Africa/Brazzaville
CD|Congo (DRC)|AFR|CDF|Africa/Kinshasa
CR|Costa Rica|LAT|CRC|America/Costa_Rica
CI|Côte d'Ivoire|AFR|XOF|Africa/Abidjan
HR|Croatia|EU|EUR|Europe/Zagreb
CU|Cuba|LAT|CUP|America/Havana
CY|Cyprus|EU|EUR|Asia/Nicosia
CZ|Czechia|EU|CZK|Europe/Prague
DK|Denmark|EU|DKK|Europe/Copenhagen
DJ|Djibouti|AFR|DJF|Africa/Djibouti
DM|Dominica|LAT|XCD|America/Dominica
DO|Dominican Republic|LAT|DOP|America/Santo_Domingo
EC|Ecuador|LAT|USD|America/Guayaquil
EG|Egypt|MENA|EGP|Africa/Cairo
SV|El Salvador|LAT|USD|America/El_Salvador
GQ|Equatorial Guinea|AFR|XAF|Africa/Malabo
ER|Eritrea|AFR|ERN|Africa/Asmara
EE|Estonia|EU|EUR|Europe/Tallinn
SZ|Eswatini|AFR|SZL|Africa/Mbabane
ET|Ethiopia|AFR|ETB|Africa/Addis_Ababa
FJ|Fiji|OCE|FJD|Pacific/Fiji
FI|Finland|EU|EUR|Europe/Helsinki
FR|France|EU|EUR|Europe/Paris
GA|Gabon|AFR|XAF|Africa/Libreville
GM|Gambia|AFR|GMD|Africa/Banjul
GE|Georgia|EE|GEL|Asia/Tbilisi
DE|Germany|DACH|EUR|Europe/Berlin
GH|Ghana|AFR|GHS|Africa/Accra
GR|Greece|EU|EUR|Europe/Athens
GD|Grenada|LAT|XCD|America/Grenada
GT|Guatemala|LAT|GTQ|America/Guatemala
GN|Guinea|AFR|GNF|Africa/Conakry
GW|Guinea-Bissau|AFR|XOF|Africa/Bissau
GY|Guyana|LAT|GYD|America/Guyana
HT|Haiti|LAT|HTG|America/Port-au-Prince
HN|Honduras|LAT|HNL|America/Tegucigalpa
HK|Hong Kong|EAS|HKD|Asia/Hong_Kong
HU|Hungary|EU|HUF|Europe/Budapest
IS|Iceland|EU|ISK|Atlantic/Reykjavik
IN|India|SAS|INR|Asia/Kolkata
ID|Indonesia|SEA|IDR|Asia/Jakarta
IR|Iran|MENA|IRR|Asia/Tehran
IQ|Iraq|MENA|IQD|Asia/Baghdad
IE|Ireland|EU|EUR|Europe/Dublin
IL|Israel|MENA|ILS|Asia/Jerusalem
IT|Italy|EU|EUR|Europe/Rome
JM|Jamaica|LAT|JMD|America/Jamaica
JP|Japan|EAS|JPY|Asia/Tokyo
JO|Jordan|MENA|JOD|Asia/Amman
KZ|Kazakhstan|EE|KZT|Asia/Almaty
KE|Kenya|AFR|KES|Africa/Nairobi
KI|Kiribati|OCE|AUD|Pacific/Tarawa
XK|Kosovo|EE|EUR|Europe/Belgrade
KW|Kuwait|GULF|KWD|Asia/Kuwait
KG|Kyrgyzstan|EE|KGS|Asia/Bishkek
LA|Laos|SEA|LAK|Asia/Vientiane
LV|Latvia|EU|EUR|Europe/Riga
LB|Lebanon|MENA|LBP|Asia/Beirut
LS|Lesotho|AFR|LSL|Africa/Maseru
LR|Liberia|AFR|LRD|Africa/Monrovia
LY|Libya|MENA|LYD|Africa/Tripoli
LI|Liechtenstein|DACH|CHF|Europe/Vaduz
LT|Lithuania|EU|EUR|Europe/Vilnius
LU|Luxembourg|EU|EUR|Europe/Luxembourg
MO|Macao|EAS|MOP|Asia/Macau
MG|Madagascar|AFR|MGA|Indian/Antananarivo
MW|Malawi|AFR|MWK|Africa/Blantyre
MY|Malaysia|SEA|MYR|Asia/Kuala_Lumpur
MV|Maldives|SAS|MVR|Indian/Maldives
ML|Mali|AFR|XOF|Africa/Bamako
MT|Malta|EU|EUR|Europe/Malta
MH|Marshall Islands|OCE|USD|Pacific/Majuro
MR|Mauritania|AFR|MRU|Africa/Nouakchott
MU|Mauritius|AFR|MUR|Indian/Mauritius
MX|Mexico|LAT|MXN|America/Mexico_City
FM|Micronesia|OCE|USD|Pacific/Pohnpei
MD|Moldova|EE|MDL|Europe/Chisinau
MC|Monaco|EU|EUR|Europe/Monaco
MN|Mongolia|EAS|MNT|Asia/Ulaanbaatar
ME|Montenegro|EE|EUR|Europe/Podgorica
MA|Morocco|MENA|MAD|Africa/Casablanca
MZ|Mozambique|AFR|MZN|Africa/Maputo
MM|Myanmar|SEA|MMK|Asia/Yangon
NA|Namibia|AFR|NAD|Africa/Windhoek
NR|Nauru|OCE|AUD|Pacific/Nauru
NP|Nepal|SAS|NPR|Asia/Kathmandu
NL|Netherlands|EU|EUR|Europe/Amsterdam
NZ|New Zealand|OCE|NZD|Pacific/Auckland
NI|Nicaragua|LAT|NIO|America/Managua
NE|Niger|AFR|XOF|Africa/Niamey
NG|Nigeria|AFR|NGN|Africa/Lagos
KP|North Korea|EAS|KPW|Asia/Pyongyang
MK|North Macedonia|EE|MKD|Europe/Skopje
NO|Norway|EU|NOK|Europe/Oslo
OM|Oman|GULF|OMR|Asia/Muscat
PK|Pakistan|SAS|PKR|Asia/Karachi
PW|Palau|OCE|USD|Pacific/Palau
PS|Palestine|MENA|ILS|Asia/Hebron
PA|Panama|LAT|PAB|America/Panama
PG|Papua New Guinea|OCE|PGK|Pacific/Port_Moresby
PY|Paraguay|LAT|PYG|America/Asuncion
PE|Peru|LAT|PEN|America/Lima
PH|Philippines|SEA|PHP|Asia/Manila
PL|Poland|EU|PLN|Europe/Warsaw
PT|Portugal|EU|EUR|Europe/Lisbon
PR|Puerto Rico|LAT|USD|America/Puerto_Rico
QA|Qatar|GULF|QAR|Asia/Qatar
RO|Romania|EU|RON|Europe/Bucharest
RU|Russia|EE|RUB|Europe/Moscow
RW|Rwanda|AFR|RWF|Africa/Kigali
KN|Saint Kitts and Nevis|LAT|XCD|America/St_Kitts
LC|Saint Lucia|LAT|XCD|America/St_Lucia
VC|Saint Vincent and the Grenadines|LAT|XCD|America/St_Vincent
WS|Samoa|OCE|WST|Pacific/Apia
SM|San Marino|EU|EUR|Europe/San_Marino
ST|São Tomé and Príncipe|AFR|STN|Africa/Sao_Tome
SA|Saudi Arabia|GULF|SAR|Asia/Riyadh
SN|Senegal|AFR|XOF|Africa/Dakar
RS|Serbia|EE|RSD|Europe/Belgrade
SC|Seychelles|AFR|SCR|Indian/Mahe
SL|Sierra Leone|AFR|SLE|Africa/Freetown
SG|Singapore|SEA|SGD|Asia/Singapore
SK|Slovakia|EU|EUR|Europe/Bratislava
SI|Slovenia|EU|EUR|Europe/Ljubljana
SB|Solomon Islands|OCE|SBD|Pacific/Guadalcanal
SO|Somalia|AFR|SOS|Africa/Mogadishu
ZA|South Africa|AFR|ZAR|Africa/Johannesburg
KR|South Korea|EAS|KRW|Asia/Seoul
SS|South Sudan|AFR|SSP|Africa/Juba
ES|Spain|EU|EUR|Europe/Madrid
LK|Sri Lanka|SAS|LKR|Asia/Colombo
SD|Sudan|AFR|SDG|Africa/Khartoum
SR|Suriname|LAT|SRD|America/Paramaribo
SE|Sweden|EU|SEK|Europe/Stockholm
CH|Switzerland|DACH|CHF|Europe/Zurich
SY|Syria|MENA|SYP|Asia/Damascus
TW|Taiwan|EAS|TWD|Asia/Taipei
TJ|Tajikistan|EE|TJS|Asia/Dushanbe
TZ|Tanzania|AFR|TZS|Africa/Dar_es_Salaam
TH|Thailand|SEA|THB|Asia/Bangkok
TL|Timor-Leste|SEA|USD|Asia/Dili
TG|Togo|AFR|XOF|Africa/Lome
TO|Tonga|OCE|TOP|Pacific/Tongatapu
TT|Trinidad and Tobago|LAT|TTD|America/Port_of_Spain
TN|Tunisia|MENA|TND|Africa/Tunis
TR|Türkiye|MENA|TRY|Europe/Istanbul
TM|Turkmenistan|EE|TMT|Asia/Ashgabat
TV|Tuvalu|OCE|AUD|Pacific/Funafuti
UG|Uganda|AFR|UGX|Africa/Kampala
UA|Ukraine|EE|UAH|Europe/Kyiv
AE|United Arab Emirates|GULF|AED|Asia/Dubai
GB|United Kingdom|EU|GBP|Europe/London
US|United States|NA|USD|America/New_York
UY|Uruguay|LAT|UYU|America/Montevideo
UZ|Uzbekistan|EE|UZS|Asia/Tashkent
VU|Vanuatu|OCE|VUV|Pacific/Efate
VA|Vatican City|EU|EUR|Europe/Vatican
VE|Venezuela|LAT|VES|America/Caracas
VN|Vietnam|SEA|VND|Asia/Ho_Chi_Minh
YE|Yemen|MENA|YER|Asia/Aden
ZM|Zambia|AFR|ZMW|Africa/Lusaka
ZW|Zimbabwe|AFR|USD|Africa/Harare`;

export interface WorldCountry { code: string; name: string; region: Region; currency: string; timeZone: string }

export const WORLD: WorldCountry[] = RAW.split("\n").map((l) => {
  const [code, name, region, currency, timeZone] = l.split("|");
  return { code, name, region: region as Region, currency, timeZone };
});
export const WORLD_BY_CODE: Record<string, WorldCountry> = Object.fromEntries(WORLD.map((c) => [c.code, c]));
