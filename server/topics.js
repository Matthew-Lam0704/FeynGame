const wordBank = require('./wordbank.json');

// Removed hardcoded topics object to prevent confusion with wordbank.json

const getRandomWord = (subject, subtopic) => {
  if (!subject || !wordBank[subject]) {
    console.error(`[TOPIC ERROR] Unknown subject: "${subject}"`);
    const subjects = Object.keys(wordBank);
    const fallbackSubject = subjects[Math.floor(Math.random() * subjects.length)];
    const subtopics = Object.keys(wordBank[fallbackSubject]);
    const fallbackSubtopic = subtopics[Math.floor(Math.random() * subtopics.length)];
    const terms = wordBank[fallbackSubject][fallbackSubtopic];
    const term = terms[Math.floor(Math.random() * terms.length)];
    return { subject: fallbackSubject, subtopic: fallbackSubtopic, term };
  }
  
  const subjectData = wordBank[subject];
  if (!subtopic || !subjectData[subtopic]) {
    console.warn(`[TOPIC WARN] Unknown subtopic: "${subtopic}" in "${subject}". Picking random subtopic.`);
    const subtopics = Object.keys(subjectData);
    const fallbackSubtopic = subtopics[Math.floor(Math.random() * subtopics.length)];
    const terms = subjectData[fallbackSubtopic];
    const term = terms[Math.floor(Math.random() * terms.length)];
    return { subject, subtopic: fallbackSubtopic, term };
  }
  
  const terms = subjectData[subtopic];
  const term = terms[Math.floor(Math.random() * terms.length)];
  console.log(`[TOPIC] ${term} (${subject} > ${subtopic})`);
  return { subject, subtopic, term };
};

module.exports = { wordBank, getRandomWord };
