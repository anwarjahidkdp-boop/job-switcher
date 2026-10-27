// Established private employers in Bangladesh whose own career pages we check regularly (scripts/ingest/bd/discover.ts).
// Only the home page is listed: the detector finds the careers link and how the jobs are published. A wrong or blocked site
// is recorded as such and never guessed around. `mnc` marks a multinational whose job board covers many countries: only
// its Bangladesh jobs are kept.
export interface BdCompany { name: string; site: string; sector: string; mnc?: boolean }

const c = (sector: string, mnc: boolean, rows: [string, string][]): BdCompany[] => rows.map(([name, site]) => ({ name, site, sector, ...(mnc ? { mnc } : {}) }));

export const BD_COMPANIES: BdCompany[] = [
  ...c('Banking & finance', false, [
    ['BRAC Bank', 'bracbank.com'], ['Eastern Bank', 'ebl.com.bd'], ['The City Bank', 'citybankplc.com'], ['Dutch-Bangla Bank', 'dutchbanglabank.com'],
    ['Prime Bank', 'primebank.com.bd'], ['Mutual Trust Bank', 'mtb.com.bd'], ['Bank Asia', 'bankasia-bd.com'], ['United Commercial Bank', 'ucb.com.bd'],
    ['ONE Bank', 'onebank.com.bd'], ['Southeast Bank', 'southeastbank.com.bd'], ['Dhaka Bank', 'dhakabankltd.com'], ['IFIC Bank', 'ificbank.com.bd'],
    ['Jamuna Bank', 'jamunabank.com.bd'], ['Pubali Bank', 'pubalibangla.com'], ['NCC Bank', 'nccbank.com.bd'], ['Mercantile Bank', 'mblbd.com'],
    ['Trust Bank', 'trustbank.com.bd'], ['Shahjalal Islami Bank', 'shahjalalbank.com.bd'], ['Islami Bank Bangladesh', 'islamibankbd.com'], ['Al-Arafah Islami Bank', 'alarafahbank.com'],
    ['Social Islami Bank', 'sibl-bd.com'], ['EXIM Bank', 'eximbankbd.com'], ['Premier Bank', 'premierbankltd.com'], ['Midland Bank', 'midlandbankbd.net'],
    ['Community Bank', 'communitybankbd.com'], ['LankaBangla Finance', 'lankabangla.com'], ['IDLC Finance', 'idlc.com'], ['IPDC Finance', 'ipdcbd.com'],
    ['Green Delta Insurance', 'green-delta.com'], ['Guardian Life Insurance', 'guardianlife.com.bd'], ['bKash', 'bkash.com'], ['Nagad', 'nagad.com.bd'],
  ]),
  ...c('Telecom & technology', false, [
    ['Grameenphone', 'grameenphone.com'], ['Robi Axiata', 'robi.com.bd'], ['Banglalink', 'banglalink.net'], ['SSL Wireless', 'sslwireless.com'],
    ['Brain Station 23', 'brainstation-23.com'], ['BJIT', 'bjitgroup.com'], ['Therap BD', 'therapbd.com'], ['Kaz Software', 'kaz.com.bd'],
    ['Enosis Solutions', 'enosisbd.com'], ['Cefalo Bangladesh', 'cefalo.com'], ['SELISE Digital Platforms', 'selisegroup.com'], ['Tiger IT', 'tigerit.com'],
    ['DataSoft Systems', 'datasoft-bd.com'], ['Southtech', 'southtechgroup.com'], ['Vivasoft', 'vivasoftltd.com'], ['Welldev', 'welldev.io'],
    ['Augmedix Bangladesh', 'augmedix.com'], ['Dynamic Solution Innovators', 'dsinnovators.com'], ['Samsung R&D Bangladesh', 'research.samsung.com'], ['Field Nation Bangladesh', 'fieldnation.com'],
  ]),
  ...c('E-commerce & startups', false, [
    ['Daraz Bangladesh', 'daraz.com.bd'], ['Chaldal', 'chaldal.com'], ['Pathao', 'pathao.com'], ['Shohoz', 'shohoz.com'], ['ShopUp', 'shopup.org'],
    ['Sheba.xyz', 'sheba.xyz'], ['10 Minute School', '10minuteschool.com'], ['Shikho', 'shikho.com'], ['Truck Lagbe', 'trucklagbe.com'], ['iFarmer', 'ifarmer.asia'],
    ['Bohubrihi', 'bohubrihi.com'], ['Bondstein Technologies', 'bondstein.com'], ['Praava Health', 'praavahealth.com'], ['Foodpanda Bangladesh', 'foodpanda.com.bd'],
  ]),
  ...c('Manufacturing, FMCG & groups', false, [
    ['Square Pharmaceuticals', 'squarepharma.com.bd'], ['Square Group', 'squaregroup.com'], ['Beximco Pharmaceuticals', 'beximcopharma.com'], ['Beximco Group', 'beximco.com'],
    ['Incepta Pharmaceuticals', 'incepta.com'], ['Renata', 'renata-ltd.com'], ['ACI Limited', 'aci-bd.com'], ['PRAN-RFL Group', 'pranrflgroup.com'],
    ['Akij Group', 'akij.net'], ['Bashundhara Group', 'bashundharagroup.com'], ['Meghna Group', 'meghnagroup.biz'], ['City Group', 'citygroupbd.com'],
    ['PARTEX STAR Group', 'partexstargroup.com'], ['Walton', 'waltonbd.com'], ['Transcom Group', 'transcombd.com'], ['Kazi Farms', 'kazifarms.com'],
    ['Navana Group', 'navana.com'], ['BSRM', 'bsrm.com'], ['Summit Group', 'summitpowerinternational.com'], ['United Group', 'united.com.bd'],
    ['DBL Group', 'dbl-group.com'], ['Envoy Textiles', 'envoytextiles.com'], ['Apex Footwear', 'apexfootwearltd.com'], ['Bata Bangladesh', 'batabd.com'],
    ['Singer Bangladesh', 'singerbd.com'], ['Berger Paints Bangladesh', 'bergerbd.com'], ['Abul Khair Group', 'abulkhairgroup.com'], ['Pran Foods', 'pranfoods.net'],
  ]),
  ...c('Health & education', false, [
    ['icddr,b', 'icddrb.org'], ['BRAC University', 'bracu.ac.bd'], ['North South University', 'northsouth.edu'], ['Independent University, Bangladesh', 'iub.edu.bd'],
    ['East West University', 'ewubd.edu'], ['Evercare Hospital Dhaka', 'evercarebd.com'], ['Square Hospitals', 'squarehospital.com'], ['United Hospital', 'uhlbd.com'],
    ['Labaid Group', 'labaidgroup.com'],
  ]),
  ...c('NGOs & development', false, [
    ['Dhaka Ahsania Mission', 'ahsaniamission.org.bd'], ['ASA', 'asa.org.bd'], ['TMSS', 'tmss-bd.org'], ['SAJIDA Foundation', 'sajidafoundation.org'],
    ['JAAGO Foundation', 'jaago.com.bd'], ['Friendship', 'friendship.ngo'], ['BURO Bangladesh', 'burobd.org'], ['Shakti Foundation', 'shakti.org.bd'],
  ]),
  ...c('Multinationals in Bangladesh', true, [
    ['Unilever Bangladesh', 'unilever.com.bd'], ['Nestlé Bangladesh', 'nestle.com.bd'], ['British American Tobacco Bangladesh', 'batbangladesh.com'], ['Marico Bangladesh', 'marico.com'],
    ['Reckitt Bangladesh', 'reckitt.com'], ['Standard Chartered Bangladesh', 'sc.com'], ['HSBC Bangladesh', 'hsbc.com.bd'], ['MetLife Bangladesh', 'metlife.com.bd'],
    ['LafargeHolcim Bangladesh', 'lafargeholcim.com.bd'], ['Novartis Bangladesh', 'novartis.com'], ['Delivery Hero', 'deliveryhero.com'], ['QIMA', 'qima.com'],
    ['Radisson Hotel Group', 'radissonhotels.com'], ['Maersk', 'maersk.com'], ['DHL', 'dhl.com'], ['Huawei Bangladesh', 'huawei.com'],
    ['Levi Strauss & Co.', 'levistrauss.com'], ['H&M Group', 'hmgroup.com'], ['Room to Read', 'roomtoread.org'], ['Ipas', 'ipas.org'],
    ['World Vision', 'wvi.org'], ['Save the Children', 'savethechildren.net'], ['Plan International', 'plan-international.org'], ['International Rescue Committee', 'rescue.org'],
  ]),
];

// Job boards already confirmed by real Bangladesh postings on them (October 2026). "@bd" keeps a global board to its Bangladesh jobs.
export const BD_EMPLOYER_BOARDS: { kind: 'smartrecruiters' | 'lever' | 'greenhouse' | 'ashby'; token: string; name: string }[] = [
  { kind: 'smartrecruiters', token: 'ShebaPlatformLimited', name: 'Sheba Platform' },
  { kind: 'smartrecruiters', token: 'BondsteinTechnologiesLtd', name: 'Bondstein Technologies' },
  { kind: 'smartrecruiters', token: '10MinuteSchool', name: '10 Minute School' },
  { kind: 'smartrecruiters', token: 'Bohubrihi', name: 'Bohubrihi' },
  { kind: 'smartrecruiters', token: 'InvariantGroupDhamakaShopping1', name: 'Dhamaka Shopping (Invariant Group)' },
  { kind: 'smartrecruiters', token: 'BolstarCareer', name: 'Bolstar' },
  { kind: 'smartrecruiters', token: 'DeliveryHero@bd', name: 'Foodpanda Bangladesh (Delivery Hero)' },
  { kind: 'smartrecruiters', token: 'QIMA@bd', name: 'QIMA Bangladesh' },
  { kind: 'smartrecruiters', token: 'RHG@bd', name: 'Radisson Hotel Group Bangladesh' },
  { kind: 'lever', token: 'fieldnation@bd', name: 'Field Nation Bangladesh' },
  { kind: 'lever', token: 'lalamove@bd', name: 'Lalamove Bangladesh' },
  { kind: 'greenhouse', token: 'speechify@bd', name: 'Speechify (Dhaka)' },
  { kind: 'ashby', token: 'Commure@bd', name: 'Commure Bangladesh' },
];
