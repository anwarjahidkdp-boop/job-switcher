/**
 * Plain, click-by-click steps for turning on email job alerts on each job site.
 * Menu names on these sites change from time to time, so the steps name what to look for, not exact pixels.
 */
export type PortalHelp = { url: string; steps: string[] };

export const PORTAL_HELP: Record<string, PortalHelp> = {
  Bdjobs: {
    url: "https://www.bdjobs.com",
    steps: [
      "Open bdjobs.com and sign in to your My Bdjobs account (create one with your Gmail if you don't have it).",
      "Search for your job: pick a category or type a job title, and choose a location if you want.",
      "On the results page, click \"Save as Favorite Search\". Bdjobs uses your saved searches to find matched jobs for you.",
      "Then open My Bdjobs → Account Settings → Email Notification, tick the job emails (matched or new jobs), and click \"Add/Update Preference\".",
    ],
  },
  LinkedIn: {
    url: "https://www.linkedin.com/jobs/",
    steps: [
      "Open linkedin.com and sign in. Click \"Jobs\" in the top bar (on the phone app, tap the Jobs tab).",
      "Type your job title in the search box, add a location, and press Search.",
      "At the top of the results, turn on the \"Set alert\" (or \"Job alert\") switch.",
      "Click \"Manage alerts\" (or Jobs → Job alerts) and set it to Daily, by Email.",
    ],
  },
  Indeed: {
    url: "https://www.indeed.com",
    steps: [
      "Open Indeed and sign in with your Gmail.",
      "Search for your job title and location.",
      "Click \"Get new jobs for this search by email\" (or the bell \"Job alert\" button) near the results.",
    ],
  },
  Bayt: {
    url: "https://www.bayt.com",
    steps: [
      "Open bayt.com and sign in with your Gmail.",
      "Search for your job title and city.",
      "Click \"Create Job Alert\" on the results page and choose daily email.",
    ],
  },
  GulfTalent: {
    url: "https://www.gulftalent.com",
    steps: [
      "Open gulftalent.com and sign in with your Gmail.",
      "Search for your job title and country.",
      "Click \"Create job alert\" (or \"Email me jobs like these\") on the results page.",
    ],
  },
  Naukrigulf: {
    url: "https://www.naukrigulf.com",
    steps: [
      "Open naukrigulf.com and sign in with your Gmail.",
      "Search for your job title and location.",
      "Click \"Create Job Alert\" on the results page and save it.",
    ],
  },
  JobStreet: {
    url: "https://www.jobstreet.com.my",
    steps: [
      "Open JobStreet and sign in with your Gmail.",
      "Search for your job title and location.",
      "Click \"Save search\" above the results and make sure email alerts are on.",
    ],
  },
  SEEK: {
    url: "https://www.seek.com.au",
    steps: [
      "Open seek.com.au and sign in with your Gmail.",
      "Search for your job title and location.",
      "Click \"Save search\" above the results and choose to get new jobs by email.",
    ],
  },
  Reed: {
    url: "https://www.reed.co.uk",
    steps: [
      "Open reed.co.uk and sign in with your Gmail.",
      "Search for your job title and location.",
      "Click \"Create job alert\" on the results page and choose daily email.",
    ],
  },
  "Job Bank": {
    url: "https://www.jobbank.gc.ca",
    steps: [
      "Open jobbank.gc.ca and sign in to your Job Bank account.",
      "Search for your job title and location.",
      "Click \"Save search\" / \"Create a job alert\" and choose email.",
    ],
  },
};
