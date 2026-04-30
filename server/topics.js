const wordBank = require('./wordbank.json');

// Removed hardcoded topics object to prevent confusion with wordbank.json

const getRandomWord = (subject, subtopic) => {
  let finalSubject = subject;
  let finalSubtopic = subtopic;

  // Fallback to random subject ONLY if none provided. If invalid provided, try to find it.
  if (!finalSubject || !wordBank[finalSubject]) {
    const subjects = Object.keys(wordBank);
    if (finalSubject && !wordBank[finalSubject]) {
       console.warn(`[TOPIC WARN] Requested subject "${finalSubject}" not in wordBank. Available: ${subjects.join(', ')}`);
    }
    finalSubject = subjects.includes(subject) ? subject : subjects[Math.floor(Math.random() * subjects.length)];
  }

  console.log(`[TOPIC SELECTION] Subject: ${finalSubject}, Subtopic: ${finalSubtopic}`);

  const subjectData = wordBank[finalSubject];
  const subtopicKeys = Object.keys(subjectData);

  // Robust subtopic matching
  if (!finalSubtopic || !subjectData[finalSubtopic]) {
    // Try fuzzy match (e.g. "Group 7" matches "Group 7 Halogens")
    const fuzzyMatch = subtopicKeys.find(key => 
      finalSubtopic && (key.toLowerCase().includes(finalSubtopic.toLowerCase()) || 
      finalSubtopic.toLowerCase().includes(key.toLowerCase()))
    );
    
    if (fuzzyMatch) {
      finalSubtopic = fuzzyMatch;
    } else {
      finalSubtopic = subtopicKeys[Math.floor(Math.random() * subtopicKeys.length)];
    }
  }

  const subtopicTerms = subjectData[finalSubtopic];
  if (!subtopicTerms || subtopicTerms.length === 0) {
    return { subject: finalSubject, subtopic: finalSubtopic, term: 'Unknown' };
  }

  const term = subtopicTerms[Math.floor(Math.random() * subtopicTerms.length)];
  console.log(`[TOPIC SELECTED] ${term} (${finalSubject} > ${finalSubtopic})`);
  return { subject: finalSubject, subtopic: finalSubtopic, term };
};

module.exports = { wordBank, getRandomWord };
