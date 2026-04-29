const wordBank = require('./wordbank.json');

const topics = {
  "Biology": [
    "Mitosis", "Photosynthesis", "Natural Selection", "The Immune System", "DNA Replication", 
    "Cellular Respiration", "Enzymes", "Protein Synthesis", "Homeostasis", "Meiosis"
  ],
  "Chemistry": [
    "Covalent Bonds", "Oxidation", "Le Chatelier's Principle", "Electron Configuration",
    "Ionic Bonding", "The Periodic Table", "Acids and Bases", "Reaction Rates", "Thermodynamics"
  ],
  "Physics": [
    "Newton's Third Law", "Wave-Particle Duality", "Entropy", "Electromagnetic Induction",
    "Special Relativity", "Quantum Tunneling", "Gravity", "Thermodynamics", "Nuclear Fusion"
  ],
  "Maths": [
    "The Chain Rule", "Proof by Contradiction", "Eigenvectors", "Integration by Parts",
    "Pythagorean Theorem", "The Golden Ratio", "Probability", "Matrices", "Complex Numbers"
  ],
  "History": [
    "The Cold War", "The French Revolution", "Causes of WW1", "The Industrial Revolution",
    "The Renaissance", "The Roman Empire", "The Civil Rights Movement"
  ],
  "Economics": [
    "Supply and Demand", "Game Theory", "Comparative Advantage", "Inflation",
    "Opportunity Cost", "Monopoly vs Competition", "Fiscal Policy"
  ]
};

const getRandomTopic = (subject) => {
  const categories = Object.keys(topics);
  const chosenSubject = subject && topics[subject] ? subject : categories[Math.floor(Math.random() * categories.length)];
  const subjectTopics = topics[chosenSubject];
  const topic = subjectTopics[Math.floor(Math.random() * subjectTopics.length)];
  return { subject: chosenSubject, topic };
};

const getRandomWord = (subject, subtopic) => {
  let finalSubject = subject;
  let finalSubtopic = subtopic;

  if (!finalSubject || !wordBank[finalSubject]) {
    const subjects = Object.keys(wordBank);
    finalSubject = subjects[Math.floor(Math.random() * subjects.length)];
  }

  const subjectData = wordBank[finalSubject];
  if (!finalSubtopic || !subjectData[finalSubtopic]) {
    const subtopics = Object.keys(subjectData);
    finalSubtopic = subtopics[Math.floor(Math.random() * subtopics.length)];
  }

  const subtopicTerms = subjectData[finalSubtopic];
  if (!subtopicTerms || subtopicTerms.length === 0) return { subject: finalSubject, subtopic: finalSubtopic, term: 'Unknown' };

  const term = subtopicTerms[Math.floor(Math.random() * subtopicTerms.length)];
  return { subject: finalSubject, subtopic: finalSubtopic, term };
};

module.exports = { topics, getRandomTopic, wordBank, getRandomWord };
