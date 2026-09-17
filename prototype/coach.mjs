// Pure local prototype logic. No model calls, inferred intent, or network access.
export function parseTranscript(text) {
  const turns = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(
      /^(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s+)?([^:\n]{1,60}):\s*(.+)$/u,
    );
    if (match && /\p{L}/u.test(match[1])) {
      turns.push({
        speaker: match[1].trim(),
        text: match[2].trim(),
        id: turns.length,
      });
    } else if (turns.length) {
      turns[turns.length - 1].text += ` ${line}`;
    }
  }
  return turns;
}

export function participants(turns) {
  return [...new Set(turns.map((turn) => turn.speaker))];
}

export function makeSession(text, person) {
  const turns = parseTranscript(text);
  if (turns.length < 2)
    throw new Error(
      "Add at least two speaker-labelled turns, such as “Alex: Can we clarify the next step?”",
    );
  if (!participants(turns).includes(person))
    throw new Error(
      "Choose your name from the transcript before opening your space.",
    );
  return {
    text,
    person,
    turns,
    ownTurns: turns.filter((turn) => turn.speaker === person),
  };
}

export function generateTranscript({
  name = "Alex",
  setting = "work",
  challenge = "clarity",
  length = "short",
} = {}) {
  name = name.trim();
  if (
    !name ||
    name.length > 50 ||
    /[:\r\n]/u.test(name) ||
    !/\p{L}/u.test(name)
  )
    throw new Error(
      "Use a character name of 1–50 characters containing a letter, without a colon or line break.",
    );
  const others = ["Morgan", "Sam", "Riley"].filter(
    (person) => person.toLowerCase() !== name.toLowerCase(),
  );
  const [lead, peer] = others;
  const settings = {
    work: {
      topic: "the project update",
      task: "the draft",
      extra: "the slides",
      place: "our next project meeting",
    },
    study: {
      topic: "our group presentation",
      task: "the research notes",
      extra: "the presentation slides",
      place: "our next study session",
    },
    community: {
      topic: "the community workshop",
      task: "the event outline",
      extra: "the invitations",
      place: "our next planning meeting",
    },
  };
  const context = settings[setting];
  if (!context) throw new Error("Choose a meeting setting.");
  const { topic, task, extra, place } = context;
  const scenes = {
    clarity: [
      [lead, `Let’s talk about ${topic}. We need to work out the next steps.`],
      [peer, `I can review ${task} once it is ready.`],
      [lead, `${name}, could you take a look at ${task} soon?`],
      [name, "What would you like me to focus on?"],
      [lead, "Just make sure it is in good shape. Perhaps before Friday."],
      [peer, `Are we deciding on a deadline now, or at ${place}?`],
      [lead, "Let’s leave the exact deadline open until we know the scope."],
      [name, "I would like to clarify the scope before I commit."],
    ],
    capacity: [
      [lead, `We’re planning ${topic}. Let’s check who has capacity.`],
      [name, `I am already working on ${task} this week.`],
      [lead, `Could you also put together ${extra} by Friday?`],
      [peer, "I can help with a review, but I cannot take on the whole task."],
      [name, "I have time for one of those tasks, but not both."],
      [lead, "They both matter. What would help us move forward?"],
      [peer, "Could we choose a priority before we finish?"],
      [lead, "We haven’t assigned the second task yet."],
    ],
    speaking: [
      [lead, `We need ideas for ${topic}. What should we change?`],
      [peer, `I think we should shorten ${task} and move on to ${extra}.`],
      [lead, "That might work. We could also change the format."],
      [name, "I have a suggestion about the format."],
      [peer, "Before I forget, could we talk about the timing too?"],
      [lead, "Yes, we have five minutes left."],
      [name, "I would still like to share my suggestion."],
      [lead, "Go ahead. What would you like us to consider?"],
    ],
  };
  if (!scenes[challenge]) throw new Error("Choose a practice moment.");
  const lines = [...scenes[challenge]];
  if (length === "long") {
    lines.splice(
      2,
      0,
      [peer, "One thing that worked last time was having a written agenda."],
      [name, "Having the main questions in writing would help me prepare."],
      [lead, `I can share an agenda before ${place}.`],
    );
    lines.push(
      [peer, "Can we keep the unresolved questions in our notes?"],
      [lead, "Yes. We can revisit those at the next meeting."],
    );
  }
  return lines.map(([speaker, text]) => `${speaker}: ${text}`).join("\n\n");
}

export const stuckOptions = {
  thread: {
    label: "I lost the thread",
    description: "Find where the conversation is now.",
    title: "Ask for a quick reset",
    steps: [
      "Pick the part you want repeated.",
      "Ask for one main point or the current question.",
      "Check your understanding before moving on.",
    ],
    scripts: {
      direct: "Could you repeat the current question and the next step?",
      gentle:
        "I would like to check I’m following. What are we deciding right now?",
      written: "Could you put the current question and next step in writing?",
    },
  },
  clarity: {
    label: "I’m not sure what is expected",
    description: "Make the task or decision more specific.",
    title: "Make the expectation concrete",
    steps: [
      "Identify the task or phrase that is unclear.",
      "Ask what the finished result should include.",
      "Confirm the owner and deadline instead of assuming.",
    ],
    scripts: {
      direct: "What should the finished result include, and when is it needed?",
      gentle: "Before I commit, could we clarify the scope and deadline?",
      written:
        "Could you write down the expected result, who owns it, and the deadline?",
    },
  },
  pause: {
    label: "I need a pause",
    description: "Make room to think or take a break.",
    title: "Give yourself processing time",
    steps: [
      "Choose whether you need a moment, a break, or a later reply.",
      "Say what you need; an explanation is optional.",
      "Suggest a return time only if you want to.",
    ],
    scripts: {
      direct: "I need a moment to think before I answer.",
      gentle: "Could we pause here? I would like some time to process this.",
      written:
        "I would like to respond in writing after I have had time to think.",
    },
  },
  disagree: {
    label: "I want to disagree",
    description: "Share a different view in your own way.",
    title: "Make room for your perspective",
    steps: [
      "Name the specific proposal you want to discuss.",
      "Share your concern without guessing anyone’s motives.",
      "Ask to consider your alternative.",
    ],
    scripts: {
      direct:
        "I see this differently. My concern is [concern]. Could we consider [alternative]?",
      gentle:
        "I would like to add another perspective. Could we look at [alternative] before deciding?",
      written:
        "I have a concern about [proposal]: [concern]. My suggested alternative is [alternative].",
    },
  },
};

export const practiceOptions = {
  clarity: {
    label: "Asking for clarity",
    description: "Turn a vague request into a clear next step.",
    goal: "Leave knowing what is expected of me.",
    prompt: "“Could you take a look at this soon and get it into good shape?”",
    prep: [
      "What does “good shape” mean for this task?",
      "What information do you need before agreeing?",
    ],
    starter: "Before I commit, could we clarify…",
    checks: [
      "I named what I need clarified.",
      "I asked a specific question about scope or timing.",
      "I avoided committing to something I do not understand.",
    ],
  },
  capacity: {
    label: "Setting a boundary",
    description: "Explain your capacity and ask for a priority.",
    goal: "Agree to work I have capacity to do.",
    prompt: "“Could you handle both tasks this week? They are both important.”",
    prep: [
      "What can you realistically take on?",
      "Which decision do you need the other person to make?",
    ],
    starter: "I have capacity for…",
    checks: [
      "I stated what I can take on.",
      "I made the trade-off or limit clear.",
      "I asked for a priority or suggested an alternative.",
    ],
  },
  speaking: {
    label: "Finding a turn to speak",
    description: "Make space for a point you want to share.",
    goal: "Get my point into the conversation.",
    prompt: "“We have a few minutes left. Let’s move to the next item.”",
    prep: [
      "What is the one point you want to contribute?",
      "Would you prefer to say it or share it in writing?",
    ],
    starter: "Before we move on, I would like to…",
    checks: [
      "I asked for space to contribute.",
      "I made my main point clear.",
      "I chose a way of contributing that works for me.",
    ],
  },
};
