// Interview preparation without AI: common questions for this job, answers built only from the verified Master CV,
// with [placeholders] where the person must add their own example.
import { skillLabel } from "../taxonomy";
import type { InterviewPrep, Job, MasterCV } from "../types";

export function templateInterview(job: Job, m: MasterCV): InterviewPrep {
  const cur = m.experience[0];
  const role = cur ? `${cur.title} at ${cur.company}` : "my most recent role";
  const mine = new Set([...m.skills_core, ...m.skills_tools].map((s) => s.toLowerCase()));
  const skills = [...job.required, ...job.preferred].slice(0, 3);
  const q: InterviewPrep["questions"] = [
    { topic: "about_you", question: "Tell me about yourself.", why: "They want a 1-minute story that connects your experience to this job.",
      answer: `${m.summary || `I am a ${m.headline}.`} Right now I work as ${role}. I'm applying for the ${job.title} role because it matches what I do best, and I'd like to bring that experience to ${job.company}.` },
    { topic: "about_you", question: `Why do you want to work at ${job.company}?`, why: "They check that you researched the company and are not applying everywhere.",
      answer: `I've followed ${job.company} and I'm interested in [one thing you like about the company: its products, growth or reputation]. The ${job.title} role fits my experience as ${role}, and I want to grow with a company like yours.` },
    ...skills.map((s) => {
      const have = mine.has(s.toLowerCase()) || [...mine].some((x) => x.includes(s.toLowerCase()));
      return { topic: "technical" as const, question: `How have you used ${skillLabel(s)} in your work?`, why: `The job asks for ${skillLabel(s)}; they want a concrete example.`,
        answer: have ? `In my work as ${role}, I use ${skillLabel(s)} regularly. For example, [describe one task: what you did, the tool or method, and the result]. That's the kind of work I'd bring to this role.`
          : `I haven't used ${skillLabel(s)} as a main part of my job yet. I understand what it's used for, and I'm [how you are learning it, e.g. an online course]. I pick up new tools quickly; for example, [a tool you learned fast].` };
    }),
    ...(job.resp.slice(0, 1).map((r) => ({ topic: "role" as const, question: `This role involves: "${r}". How would you handle it?`, why: "They want to see you understand the day-to-day work.",
      answer: `In ${role} I handled similar work. My approach would be to [first step], then [second step], and keep my manager updated. In my first months I'd learn your current process before suggesting changes.` }))),
    { topic: "behavioural", question: "Tell me about a challenge you solved at work.", why: "They want a real story: Situation, Task, Action, Result.",
      answer: `At ${cur?.company || "my last job"}, [the situation]. My task was to [what you had to do]. I [the actions you took]. As a result, [the outcome, with a number if you can].` },
    { topic: "behavioural", question: "Describe a time you worked under a tight deadline.", why: "They check how you plan and stay calm under pressure.",
      answer: `During [the deadline, e.g. a month-end or audit], I listed the tasks, did the most important ones first and told my manager early about any risk. We finished on time, and [what you learned].` },
    { topic: "behavioural", question: "Tell me about a time you disagreed with a colleague or manager.", why: "They want to see you can disagree respectfully and still deliver.",
      answer: `[The situation]. I explained my view with facts, listened to theirs, and we agreed to [the decision]. The work got done, and our working relationship stayed good.` },
    { topic: "company", question: "Where do you see yourself in five years?", why: "They check whether you will stay and grow with them.",
      answer: `I see myself growing in ${job.title.toLowerCase()} work, taking on more responsibility and [a skill you want to build]. I'd like to do that inside one company where I can prove myself over time.` },
    { topic: "salary", question: "What are your salary expectations and notice period?", why: "They check that you fit their budget and timeline.",
      answer: `Based on my experience and the market, I'm looking for around [your expected range]. I'm flexible for the right role. My notice period is [your notice period].` },
  ];
  return {
    // Names like "Ltd." end with a full stop, so drop the doubled one the sentences add.
    questions: q.map((x) => ({ ...x, question: x.question.replace(/\.\.(?!\.)/g, "."), answer: x.answer.replace(/\.\.(?!\.)/g, ".") })),
    ask_them: ["What would success look like in this role after the first 3 months?", "What are the biggest challenges the team is facing right now?", "What are the next steps after this interview?"],
    checklist: [`Read about ${job.company}: what it does, its products and recent news`, "Practise your answers out loud, especially 'Tell me about yourself'", "Prepare two real examples with numbers from your work", "Keep printed copies of your CV and certificates ready", "Check the time, place or video link a day before, and arrive or join 10 minutes early"],
  };
}
