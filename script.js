let plays = [];
let cards = [];
let currentCard = 0;
let promptLog = JSON.parse(localStorage.getItem("promptLog") || "[]");
let diagrams = JSON.parse(localStorage.getItem("diagrams") || "[]");
let studyContent = null;

function showSection(id) {
  document.querySelectorAll("section").forEach((section) => {
    section.classList.remove("active");
  });
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function initNav() {
  document.querySelectorAll("nav button").forEach((btn) => {
    btn.addEventListener("click", () => showSection(btn.dataset.section));
  });
  
  // Make dashboard cards clickable using event delegation
  const dashboardGrid = document.querySelector(".dashboard-grid");
  if (dashboardGrid) {
    dashboardGrid.addEventListener("click", (e) => {
      // Find the closest dashboard-card parent
      const card = e.target.closest(".dashboard-card");
      if (card && card.dataset.section) {
        console.log('Dashboard card clicked, navigating to:', card.dataset.section);
        showSection(card.dataset.section);
      }
    });
    console.log('Dashboard card click handler attached');
  }
}

function loadPlays() {
  return fetch("plays.json")
    .then((r) => r.json())
    .then((data) => {
      plays = data.plays || [];
      populateDiagramSelect();
      populatePlayList();
      return loadDiagrams();
    })
    .catch((e) => {
      console.warn("Could not load plays.json", e);
    });
}

function loadDiagrams() {
  return fetch("diagrams.json")
    .then((r) => r.json())
    .then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        diagrams = data;
        localStorage.setItem("diagrams", JSON.stringify(diagrams));
        populateDiagramGallery();
      }
      return loadStudyContent();
    })
    .catch((e) => {
      console.warn("Could not load diagrams.json, using localStorage", e);
      populateDiagramGallery();
      return loadStudyContent();
    });
}

function loadStudyContent() {
  return fetch("study_content.json")
    .then((r) => r.json())
    .then((data) => {
      studyContent = data;
      console.log("Study content loaded:", studyContent);
    })
    .catch((e) => {
      console.warn("Could not load study_content.json", e);
    });
}

function populatePlayList() {
  const playList = document.getElementById("playList");
  playList.innerHTML = "";
  if (!plays.length) {
    playList.innerHTML = "<p>No plays loaded. Import a playbook or add sample plays.</p>";
    return;
  }
  plays.forEach((play) => {
    const div = document.createElement("div");
    div.className = "playCard";
    div.innerHTML = `
      <h3>${play.name}</h3>
      <p><strong>Formation:</strong> ${play.offensiveFormation || play.formation || "-"}</p>
      <p><strong>Coverage:</strong> ${play.coverage || "-"}</p>
      <p><strong>Blitz:</strong> ${play.blitz || "-"}</p>
      <p><strong>Note:</strong> ${play.note || "-"}</p>
    `;

    // Attach diagrams for this play (thumbnails)
    const dWrap = document.createElement("div");
    dWrap.className = "diagram-thumbs";

    if (play.diagram) {
      const img = document.createElement("img");
      img.src = play.diagram;
      img.alt = play.name + " diagram";
      img.className = "diagram-thumb";
      img.title = play.name + " (imported)";
      img.addEventListener("click", () => openLightbox(img.src));
      dWrap.appendChild(img);
    }

    const related = diagrams.filter((d) => d.playName === play.name);
    related.forEach((d) => {
      const img = document.createElement("img");
      img.src = d.dataUrl;
      img.alt = d.name || "diagram";
      img.className = "diagram-thumb";
      img.title = d.name || d.playName;
      img.addEventListener("click", () => openLightbox(img.src));
      dWrap.appendChild(img);
    });

    if (dWrap.children.length) {
      div.appendChild(document.createElement("hr"));
      const label = document.createElement("div");
      label.textContent = "Attached diagrams:";
      div.appendChild(label);
      div.appendChild(dWrap);
    }

    // Add edit button
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit Play";
    editBtn.className = "edit-play-btn";
    editBtn.addEventListener("click", () => {
      window.editPlayIndex = plays.findIndex((p) => p.name === play.name);
      document.getElementById("playName").value = play.name;
      document.getElementById("playOffensiveFormation").value = play.offensiveFormation || "";
      document.getElementById("playOffensivePlay").value = play.offensivePlay || "";
      document.getElementById("playDefensiveFormation").value = play.defensiveFormation || "";
      document.getElementById("playCoverage").value = play.coverage || "";
      document.getElementById("playBlitz").value = play.blitz || "";
      document.getElementById("playNote").value = play.note || "";
      document.getElementById("playKeyReads").value = (play.keyReads || []).join(", ");
      document.getElementById("playMikeResp").value = (play.responsibilities && play.responsibilities.Mike) || (play.defResponsibilities && play.defResponsibilities.Mike) || "";
      document.getElementById("playWillResp").value = (play.responsibilities && play.responsibilities.Will) || (play.defResponsibilities && play.defResponsibilities.Will) || "";
      // Pre-select the play in the diagram selector so user can upload/replace diagram
      document.getElementById("playSelectForDiagram").value = play.name;
      document.getElementById("addPlayForm").classList.remove("hidden");
      // Scroll to form
      document.getElementById("addPlayForm").scrollIntoView({ behavior: 'smooth' });
      window.isEditingPlay = true;
      toast(`Editing "${play.name}" — scroll down to update diagram`, { type: 'info' });
    });
    div.appendChild(editBtn);

    // Add delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete Play";
    deleteBtn.className = "delete-play-btn";
    deleteBtn.addEventListener("click", () => {
      if (!confirm(`Delete play "${play.name}"?`)) return;
      plays = plays.filter((p) => p.name !== play.name);
      populatePlayList();
      populateDiagramSelect();
      recordPromptLog("delete_play", `Deleted play: ${play.name}`);
    });
    div.appendChild(deleteBtn);

    playList.appendChild(div);
  });
}
 

function prevCard() {
  if (!cards.length) return;
  currentCard = (currentCard - 1 + cards.length) % cards.length;
  renderCard();
}

/* -- Quiz -- */

// Helper functions for flexible answer grading
function normalizeAnswer(str) {
  return str
    .toLowerCase()
    .replace(/both|the/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(str) {
  return str
    .toLowerCase()
    .replace(/both|the|and/g, '')
    .replace(/[^a-z]/g, '')
    .trim();
}

function parseSetAnswer(str) {
  return str
    .split(/[\+,&]/)
    .map(normalizeToken)
    .filter(Boolean)
    .sort();
}

function isCorrectFreeResponse(userAnswer, question) {
  const userNorm = normalizeAnswer(userAnswer);
  return question.acceptableAnswers?.some(ans => normalizeAnswer(ans) === userNorm);
}

function isCorrectSetAnswer(userAnswer, question) {
  const userSet = parseSetAnswer(userAnswer);
  const correctSet = question.requiredItems.map(normalizeToken).sort();
  if (userSet.length !== correctSet.length) return false;
  return userSet.every((item, i) => item === correctSet[i]);
}

function startQuiz() {
  const quizContainer = document.getElementById("quizContainer");
  quizContainer.innerHTML = "";
  
  if (!studyContent || !studyContent.quizQuestions) {
    quizContainer.textContent = "Study content not loaded. Please refresh the page.";
    return;
  }
  
  try {
    const allQuestions = studyContent.quizQuestions;
    const selectedQuestions = shuffle([...allQuestions]).slice(0, 10);
    
    let score = 0;
    let answered = 0;
    
    selectedQuestions.forEach((q, idx) => {
      const qDiv = document.createElement("div");
      qDiv.className = "playCard";
      const title = document.createElement("h3");
      const formationLabel = q.offensiveFormation ? ` vs ${q.offensiveFormation}` : '';
      title.textContent = `Q${idx + 1} [${q.play}${formationLabel}]: ${q.question}`;
      qDiv.appendChild(title);
      
      if (q.type === "mcq") {
        // Multiple choice
        q.options.forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = 'button';
          btn.textContent = opt;
          btn.addEventListener("click", () => {
            if (btn.classList.contains("answered")) return;
            btn.classList.add("answered");
            answered++;
            
            if (opt === q.answer) {
              btn.style.background = "#2ecc71";
              score++;
            } else {
              btn.style.background = "#e74c3c";
            }
            
            // Reveal correct answer
            Array.from(qDiv.querySelectorAll("button")).forEach((b) => {
              if (b.textContent === q.answer) b.style.border = "2px solid #2ecc71";
              b.disabled = true;
            });
            
            if (answered === selectedQuestions.length) {
              showQuizResults(quizContainer, score, selectedQuestions.length);
            }
          });
          qDiv.appendChild(btn);
        });
      } else if (q.type === "tf") {
        // True/False
        ["True", "False"].forEach((opt) => {
          const btn = document.createElement("button");
          btn.type = 'button';
          btn.textContent = opt;
          btn.addEventListener("click", () => {
            if (btn.classList.contains("answered")) return;
            btn.classList.add("answered");
            answered++;
            
            const userAnswer = opt === "True";
            if (userAnswer === q.answer) {
              btn.style.background = "#2ecc71";
              score++;
            } else {
              btn.style.background = "#e74c3c";
            }
            
            // Show correct answer
            const correctText = q.answer ? "True" : "False";
            Array.from(qDiv.querySelectorAll("button")).forEach((b) => {
              if (b.textContent === correctText) b.style.border = "2px solid #2ecc71";
              b.disabled = true;
            });
            
            if (answered === selectedQuestions.length) {
              showQuizResults(quizContainer, score, selectedQuestions.length);
            }
          });
          qDiv.appendChild(btn);
        });
      } else if (q.type === "fillin") {
        // Fill in the blank
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Type your answer...";
        input.style.width = "80%";
        input.style.padding = "8px";
        input.style.marginTop = "10px";
        qDiv.appendChild(input);
        
        const submitBtn = document.createElement("button");
        submitBtn.textContent = "Submit";
        submitBtn.style.marginTop = "10px";
        submitBtn.addEventListener("click", () => {
          if (submitBtn.classList.contains("answered")) return;
          submitBtn.classList.add("answered");
          answered++;
          
          const userAnswer = input.value.trim();
          let isCorrect = false;
          
          // Use flexible grading logic
          if (q.requiredItems) {
            isCorrect = isCorrectSetAnswer(userAnswer, q);
          } else if (q.acceptableAnswers) {
            isCorrect = isCorrectFreeResponse(userAnswer, q);
          } else {
            // Fallback to simple substring comparison
            const userLower = userAnswer.toLowerCase();
            const correctLower = q.answer.toLowerCase();
            isCorrect = userLower.includes(correctLower) || correctLower.includes(userLower);
          }
          
          if (isCorrect) {
            input.style.background = "#d5f4e6";
            input.style.border = "2px solid #2ecc71";
            score++;
          } else {
            input.style.background = "#fadbd8";
            input.style.border = "2px solid #e74c3c";
          }
          
          const answerText = document.createElement("p");
          answerText.textContent = `Correct answer: ${q.answer}`;
          answerText.style.color = "#2ecc71";
          answerText.style.marginTop = "8px";
          qDiv.appendChild(answerText);
          
          input.disabled = true;
          submitBtn.disabled = true;
          
          if (answered === selectedQuestions.length) {
            showQuizResults(quizContainer, score, selectedQuestions.length);
          }
        });
        qDiv.appendChild(submitBtn);
      }
      
      quizContainer.appendChild(qDiv);
    });
  } catch (err) {
    console.error('Error running quiz', err);
    quizContainer.textContent = 'Could not start quiz — see console for details.';
  }
}

function showQuizResults(container, score, total) {
  const res = document.createElement("div");
  res.className = "playCard";
  res.style.background = "#2c3e50";
  res.style.color = "#ecf0f1";
  res.innerHTML = `
    <h2>Quiz Complete!</h2>
    <h3>Score: ${score}/${total} (${Math.round((score/total)*100)}%)</h3>
    <p>${score === total ? "Perfect! You know your plays!" : score >= total * 0.7 ? "Great job! Keep studying." : "Keep practicing. Review the flashcards and try again!"}</p>
  `;
  container.appendChild(res);
  recordPromptLog("quiz_run", `Questions:${total} Score:${score}`);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* -- Scenario Drill (simulated AI) -- */
function startScenario() {
  const container = document.getElementById("scenarioContainer");
  container.innerHTML = "";
  
  if (!studyContent || !studyContent.scenarios) {
    container.textContent = "Study content not loaded. Please refresh the page.";
    return;
  }
  
  if (!plays.length) {
    container.textContent = "Load plays before running a scenario.";
    return;
  }
  
  // Pick a random play that has a scenario
  const playNames = Object.keys(studyContent.scenarios);
  const selectedPlayName = playNames[Math.floor(Math.random() * playNames.length)];
  const scenario = studyContent.scenarios[selectedPlayName];
  
  const qDiv = document.createElement("div");
  qDiv.className = "playCard";
  
  const title = document.createElement("h3");
  title.textContent = `Scenario: ${selectedPlayName}`;
  qDiv.appendChild(title);
  
  const setup = document.createElement("p");
  setup.textContent = scenario.setup;
  setup.style.fontWeight = "bold";
  setup.style.marginBottom = "12px";
  qDiv.appendChild(setup);
  
  const question = document.createElement("p");
  question.textContent = scenario.question;
  question.style.marginBottom = "12px";
  qDiv.appendChild(question);
  
  const revealBtn = document.createElement("button");
  revealBtn.textContent = "Show Coaching Points";
  revealBtn.addEventListener("click", () => {
    if (revealBtn.classList.contains("revealed")) return;
    revealBtn.classList.add("revealed");
    revealBtn.disabled = true;
    
    const pointsDiv = document.createElement("div");
    pointsDiv.style.background = "#d5f4e6";
    pointsDiv.style.padding = "12px";
    pointsDiv.style.marginTop = "12px";
    pointsDiv.style.borderRadius = "4px";
    pointsDiv.style.color = "#1a252f";
    
    const pointsTitle = document.createElement("h4");
    pointsTitle.textContent = "Correct Coaching Points:";
    pointsTitle.style.color = "#1a252f";
    pointsTitle.style.fontWeight = "bold";
    pointsTitle.style.marginBottom = "8px";
    pointsDiv.appendChild(pointsTitle);
    
    const pointsList = document.createElement("ul");
    pointsList.style.color = "#1a252f";
    pointsList.style.fontWeight = "500";
    scenario.coachingPoints.forEach((point) => {
      const li = document.createElement("li");
      li.textContent = point;
      li.style.color = "#1a252f";
      li.style.marginBottom = "4px";
      pointsList.appendChild(li);
    });
    pointsDiv.appendChild(pointsList);
    
    qDiv.appendChild(pointsDiv);
    recordPromptLog(`Scenario: ${selectedPlayName}`, `Reviewed coaching points`);
  });
  qDiv.appendChild(revealBtn);
  
  container.appendChild(qDiv);
}

/* -- LLM-backed Scenario (calls backend) -- */
async function callAI(prompt) {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, max_tokens: 600 }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }
    const data = await res.json();
    return data; // return full response object (may include structured payload)
  } catch (e) {
    console.error("AI call failed", e);
    return `AI error: ${e.message}`;
  }
}

async function startScenarioAI() {
  const container = document.getElementById("scenarioContainer");
  container.innerHTML = "";
  showStatus('Generating AI scenario — please wait...');
  if (!plays.length) {
    container.textContent = "Load plays before running a scenario.";
    hideStatus();
    return;
  }
  const p = plays[Math.floor(Math.random() * plays.length)];
  
  const prompt = `Generate a defensive recognition scenario based on the selected play.

Play Information:
- Name: ${p.name}
- Offensive Formation: ${p.offensiveFormation}
- Expected Offensive Concepts: ${p.offensivePlay}
- Defensive Formation: ${p.defensiveFormation}
- Coverage: ${p.coverage}
- Blitz: ${p.blitz}
- Note: ${p.note}
- Key Reads: ${p.keyReads ? p.keyReads.join(', ') : 'N/A'}
- Mike Responsibility: ${p.responsibilities ? p.responsibilities.Mike : 'N/A'}
- Will Responsibility: ${p.responsibilities ? p.responsibilities.Will : 'N/A'}

IMPORTANT: The first sentence of your scenario MUST explicitly state "You're playing ${p.name} ..." and the entire scenario logic must be consistent with that specific defensive call (${p.coverage}, ${p.blitz}).

The scenario should include:
- Pre-snap motion
- A primary offensive route concept from: ${p.offensivePlay}
- A post-snap conflict for the defender
- A question requiring the user to identify their assignment or adjustment

Provide:
1) A short game-like scenario (2-3 sentences) describing the offensive alignment and motion, starting with "You're playing ${p.name} ..."
2) 3 multiple-choice options (A/B/C) for the correct defensive adjustment
3) The correct option and a brief coaching explanation

Format your response as JSON with this structure:
{
  "scenario": "...",
  "options": ["A", "B", "C"],
  "correctIndex": 0,
  "explanation": "...",
  "coachingCue": "..."
}`;

  const data = await callAI(prompt);
  
  // Fall back to local generator if AI failed
  let structured = null;
  if (data && typeof data === 'object' && data.structured) {
    structured = data.structured;
  } else if (typeof data === 'string' && data.toLowerCase().startsWith('ai error')) {
    console.warn('AI backend error, using local generator:', data);
    structured = generateLocalScenario(p);
  } else {
    structured = generateLocalScenario(p);
  }
  hideStatus();
  
  container.innerHTML = "";
  const card = document.createElement("div");
  card.className = "playCard";
  
  if (structured) {
    const s = structured;
    const title = document.createElement("h3");
    title.textContent = s.scenario;
    card.appendChild(title);
    const optsWrap = document.createElement("div");
    optsWrap.className = "controls";
    s.options.forEach((opt, idx) => {
      const btn = document.createElement("button");
      btn.textContent = `${String.fromCharCode(65 + idx)}) ${opt}`;
      btn.addEventListener("click", () => {
        if (btn.classList.contains("answered")) return;
        btn.classList.add("answered");
        if (idx === s.correctIndex) {
          btn.style.background = "#2ecc71";
        } else {
          btn.style.background = "#e74c3c";
        }
        Array.from(optsWrap.querySelectorAll("button")).forEach((b, i) => {
          if (i === s.correctIndex) b.style.border = "2px solid #2ecc71";
          b.disabled = true;
        });
        const expl = document.createElement("p");
        expl.textContent = `Answer: ${String.fromCharCode(65 + s.correctIndex)} — ${s.options[s.correctIndex]}`;
        const expl2 = document.createElement('p');
        expl2.textContent = s.explanation;
        const cue = document.createElement('p');
        cue.style.fontStyle = 'italic';
        cue.textContent = `Coaching cue: ${s.coachingCue}`;
        card.appendChild(expl);
        card.appendChild(expl2);
        card.appendChild(cue);
        recordPromptLog(prompt, JSON.stringify(s));
      });
      optsWrap.appendChild(btn);
    });
    card.appendChild(optsWrap);
    container.appendChild(card);
  } else {
    const pre = document.createElement("pre");
    pre.textContent = 'Could not generate scenario.';
    card.appendChild(pre);
    container.appendChild(card);
  }
}


/* -- Prompt Log -- */
function recordPromptLog(prompt, response) {
  const entry = { time: new Date().toISOString(), prompt, response };
  promptLog.unshift(entry);
  localStorage.setItem("promptLog", JSON.stringify(promptLog.slice(0, 500)));
  updatePromptList();
}

function updatePromptList() {
  const ul = document.getElementById("promptList");
  ul.innerHTML = "";
  promptLog.forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${new Date(e.time).toLocaleString()}</strong>: <em>${escapeHtml(e.prompt)}</em><br/>${escapeHtml(e.response)}`;
    ul.appendChild(li);
  });
}

/* -- Local scenario generator (fallback when AI backend is unavailable) -- */
function generateLocalScenario(p) {
  // Choose a short scenario and a question about Mike's responsibility
  const formation = p.offensiveFormation || 'an unknown formation';
  const playDesc = p.offensivePlay || 'a generic play';
  const coverage = p.coverage || p.name || 'this defense';
  const scenario = `You're playing ${coverage}. Offense shows ${formation} and runs ${playDesc}. As the Mike, what is your primary post-snap responsibility?`;

  const correct = (p.responsibilities && p.responsibilities.Mike) || (p.defResponsibilities && p.defResponsibilities.Mike) || p.coverage || 'Short middle zone';

  const fallbackOpts = [
    'Hook/curl zone',
    'Deep middle coverage',
    'Man on RB/TE',
    'Flat zone (force outside)',
    'Edge contain / rush',
    'Short middle zone'
  ];
  const options = new Set([correct]);
  // add two distractors
  let i = 0;
  while (options.size < 3 && i < fallbackOpts.length) {
    const pick = fallbackOpts[Math.floor(Math.random() * fallbackOpts.length)];
    if (!options.has(pick)) options.add(pick);
    i++;
  }
  // ensure 3 options
  const optsArr = Array.from(options).slice(0,3);
  // shuffle and pick correct index
  const shuffled = shuffle(optsArr);
  const correctIndex = shuffled.findIndex(x => x === correct);

  const explanation = p.note || `On ${p.name || 'this play'}, the Mike's role is ${correct}.`;
  const coachingCue = (p.keyReads && p.keyReads.length) ? `Key reads: ${p.keyReads.join(', ')}.` : 'Watch the RB release and QB drop.';

  return {
    scenario,
    options: shuffled,
    correctIndex,
    explanation,
    coachingCue
  };
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function generateFlashcardsFromPlays() {
  if (!studyContent || !studyContent.flashcards) {
    toast('Study content not loaded. Please refresh the page.', { type: 'warn' });
    return;
  }
  
  cards = [];
  Object.keys(studyContent.flashcards).forEach((playName) => {
    const playCards = studyContent.flashcards[playName];
    playCards.forEach((card) => {
      cards.push({
        q: `[${playName}] ${card.q}`,
        a: card.a,
        playName: playName
      });
    });
  });
  
  if (!cards.length) {
    toast('No flashcards available.', { type: 'warn' });
    return;
  }
  
  currentCard = 0;
  renderCard();
  toast(`Generated ${cards.length} flashcards from all plays!`, { type: 'success' });
  recordPromptLog('generate_flashcards', `Generated ${cards.length} flashcards from plays`);
}

/* -- Lightbox for diagrams -- */
function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  if (!lb || !img) return;
  img.src = src;
  lb.classList.remove("hidden");
}

/* -- Status & Toast helpers -- */
function showStatus(msg) {
  const el = document.getElementById('statusBanner');
  if (!el) return console.log('status:', msg);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideStatus() {
  const el = document.getElementById('statusBanner');
  if (!el) return;
  el.classList.add('hidden');
  el.textContent = '';
}

function toast(message, opts = {}) {
  const container = document.getElementById('toasts');
  if (!container) return console.log('toast:', message);
  const div = document.createElement('div');
  div.className = 'toast ' + (opts.type || 'info');
  div.textContent = message;
  container.appendChild(div);
  const timeout = opts.timeout || 4000;
  setTimeout(() => {
    div.style.opacity = '0';
    setTimeout(() => div.remove(), 300);
  }, timeout);
  return div;
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImg");
  if (!lb) return;
  lb.classList.add("hidden");
  if (img) img.src = "";
}

/* -- Import / Save plays -- */
// Parse playbook text (heuristics): find headings and responsibilities
function parsePlaysFromText(fullText) {
  const lines = fullText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const plays = [];

  // Helper: decide if a line is a heading (e.g., CAPITALS or contains 'Cover')
  function isHeading(line) {
    if (/cover\s*\d+/i.test(line)) return true;
    // All-caps short headings (e.g., "COVER 1", "DAGGER")
    const letters = line.replace(/[^A-Z]/g, '');
    if (letters.length >= Math.max(3, Math.min(12, Math.floor(line.length * 0.6)))) return true;
    // Title-case headings with keyword
    if (/^(Cover|Dagger|Sam|Under|Base|Blitz|Robber|Quarters)\b/i.test(line)) return true;
    return false;
  }

  // Collect sections: heading -> body lines
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isHeading(line)) {
      const heading = line.replace(/[^\w\s\-\d]/g, '').trim();
      i++;
      const body = [];
      while (i < lines.length && !isHeading(lines[i])) {
        body.push(lines[i]);
        i++;
      }

      // Attempt to extract responsibilities and key reads from body
      const bodyText = body.join(' ');
      const play = {
        name: heading || 'Imported Play',
        offensiveFormation: 'Various',
        offensivePlay: 'Various',
        defensiveFormation: '4-2-5',
        coverage: heading,
        blitz: 'Varies',
        note: '',
        keyReads: [],
        responsibilities: { Mike: 'TBD', Will: 'TBD' },
        defResponsibilities: {},
        diagram: ''
      };

      // Find responsibilities block by keywords
      const respMatch = bodyText.match(/(responsibilit(?:y|ies)|assignments|roles)[:\-\s]*([^\.\n]+)/i);
      if (respMatch) {
        play.note += respMatch[0] + '\n';
        // Parse patterns like "Mike: X, Will: Y" or "Mike - X"
        const parts = respMatch[2].split(/[;,\n]/).map(s => s.trim()).filter(Boolean);
        parts.forEach(p => {
          const m = p.match(/^(Mike|Will|Sam|Star|Nickel|FS|SS|CB[-\s]?L|CB[-\s]?R)[:\-\s]+(.+)$/i);
          if (m) {
            const role = m[1].replace(/\s+/g, '');
            play.responsibilities[role] = m[2].trim();
            play.defResponsibilities[role] = m[2].trim();
          }
        });
      }

      // Extract lines that look like 'Mike — description' anywhere in body
      const inlineResp = body.filter(l => /^\s*(Mike|Will|Sam|Star|Nickel|FS|SS|CB)/i.test(l));
      inlineResp.forEach(l => {
        const m = l.match(/^(Mike|Will|Sam|Star|Nickel|FS|SS|CB[-\s]?L|CB[-\s]?R)[:\-\u2014\s]+(.+)$/i);
        if (m) {
          const role = m[1].replace(/\s+/g, '');
          play.defResponsibilities[role] = m[2].trim();
          // also map to responsibilities if Mike/Will
          if (/^Mike$/i.test(role) || /^Will$/i.test(role)) play.responsibilities[role] = m[2].trim();
        }
      });

      // Look for Key Reads or Keys
      const keysMatch = bodyText.match(/(key reads|keys|reads|keys to read)[:\-\s]*([^\.\n]+)/i);
      if (keysMatch) {
        play.keyReads = keysMatch[2].split(/[;,]/).map(s => s.trim()).filter(Boolean);
      } else {
        // try to find common short phrases
        const maybeKeys = body.filter(l => /read|reads|keys|look for/i.test(l));
        if (maybeKeys.length) {
          play.keyReads = maybeKeys.join(' ').split(/[,;\.] /).slice(0,5).map(s=>s.trim()).filter(Boolean);
        }
      }

      // Put remaining as note
      play.note = (play.note + ' ' + bodyText).trim().slice(0,3000);
      plays.push(play);
    } else {
      i++;
    }
  }

  return plays;
}

function wireImport() {
  const fileInput = document.getElementById("fileInput");
  document.getElementById("importButton").addEventListener("click", async () => {
    const f = fileInput.files[0];
    console.log('[import] click - file=', f);
    if (!f) return toast('Choose a playbook file (JSON or PDF) first.', { type: 'warn' });

    // ensure pdfjs worker is set (fallback)
    try {
      if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        console.log('[import] pdfjs workerSrc set to CDN fallback');
      }
    } catch (e) {
      console.warn('Could not set pdfjs workerSrc', e);
    }
      // PDF import with image extraction
      if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        try {
          showStatus('Starting PDF import — this may take a few seconds...');
          const arrayBuffer = await f.arrayBuffer();
          console.log('[import] PDF arrayBuffer size', arrayBuffer && arrayBuffer.byteLength);
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          console.log('[import] PDF loaded — pages=', pdf.numPages);

          // Detect headings on pages
          const detectedPlays = [];
          const headingRegex = /cover\s*\d+|cover1|cover2|cover4/i;

          for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            const items = content.items || [];
            for (let idx = 0; idx < items.length; idx++) {
              const txt = items[idx].str || '';
              if (!txt) continue;
              if (headingRegex.test(txt)) {
                const transform = items[idx].transform || [1,0,0,1,0,0];
                const tx = transform[4];
                const ty = transform[5];
                const start = Math.max(0, idx - 6);
                const end = Math.min(items.length, idx + 20);
                const excerpt = items.slice(start, end).map(it => it.str).join(' ').replace(/\s+/g,' ');
                const name = txt.replace(/[^\w\s\d]/g,'').replace(/cover\s*1/i,'Cover 1').replace(/cover1/i,'Cover 1').replace(/cover\s*2/i,'Cover 2').replace(/cover2/i,'Cover 2').replace(/cover\s*4/i,'Cover 4').replace(/cover4/i,'Cover 4');
                detectedPlays.push({ name: name.trim(), pageIndex: p, tx, ty, excerpt });
              }
            }
          }

          // If none detected, fallback to scanning full text
          if (detectedPlays.length === 0) {
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              fullText += content.items.map(it => it.str).join(' ') + '\n\n';
            }
            const lower = fullText.toLowerCase();
            const pats = ['cover 1','cover1','cover 2','cover2','cover 4','cover4'];
            pats.forEach(pat => {
              const idx = lower.indexOf(pat);
              if (idx !== -1) {
                const start = Math.max(0, idx - 200);
                const end = Math.min(fullText.length, idx + 200);
                const excerpt = fullText.substring(start, end).replace(/\s+/g,' ');
                detectedPlays.push({ name: pat.replace(/cover\s*/i,'Cover '), pageIndex: 1, tx:50, ty:50, excerpt });
              }
            });
          }

          const playsFound = [];
          for (const det of detectedPlays) {
            const page = await pdf.getPage(det.pageIndex);
            const scale = 2.0;
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await page.render({ canvasContext: ctx, viewport }).promise;

            let vx = det.tx || 50;
            let vy = det.ty || 50;
            try {
              const [cx, cy] = viewport.convertToViewportPoint(vx, vy);
              vx = cx; vy = cy;
            } catch (e) {}

            // initial crop around heading (wider by default)
            const cropX = Math.max(0, Math.floor(vx - 200));
            const cropY = Math.max(0, Math.floor(vy - 20));
            const cropW = Math.min(canvas.width - cropX, 800);
            const cropH = Math.min(canvas.height - cropY, 800);

            // analyze the cropped area for non-white pixel bounds to better isolate diagrams
            const tmp = document.createElement('canvas');
            tmp.width = cropW; tmp.height = cropH;
            const tctx = tmp.getContext('2d');
            tctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            let imgData;
            try {
              imgData = tctx.getImageData(0, 0, cropW, cropH);
            } catch (e) {
              imgData = null;
            }

            let finalX = 0, finalY = 0, finalW = cropW, finalH = cropH;
            if (imgData) {
              const data = imgData.data;
              let minX = cropW, minY = cropH, maxX = 0, maxY = 0;
              const threshold = 240; // near-white threshold
              for (let yy = 0; yy < cropH; yy++) {
                for (let xx = 0; xx < cropW; xx++) {
                  const i = (yy * cropW + xx) * 4;
                  const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
                  if (a === 0) continue;
                  // treat as non-white if any channel significantly below threshold
                  if (r < threshold || g < threshold || b < threshold) {
                    if (xx < minX) minX = xx;
                    if (yy < minY) minY = yy;
                    if (xx > maxX) maxX = xx;
                    if (yy > maxY) maxY = yy;
                  }
                }
              }
              if (maxX > minX && maxY > minY) {
                // expand a little padding
                const pad = 12;
                const sx = Math.max(0, minX - pad);
                const sy = Math.max(0, minY - pad);
                const ex = Math.min(cropW, maxX + pad);
                const ey = Math.min(cropH, maxY + pad);
                finalX = sx; finalY = sy; finalW = ex - sx; finalH = ey - sy;
              }
            }

            // create final cropped canvas
            const out = document.createElement('canvas');
            out.width = finalW; out.height = finalH;
            const outCtx = out.getContext('2d');
            outCtx.fillStyle = '#fff'; outCtx.fillRect(0,0,finalW,finalH);
            outCtx.drawImage(tmp, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
            const dataUrl = out.toDataURL('image/png');

            // attach diagram entry to diagrams (persisted)
            try {
              const entry = { id: Date.now().toString() + '-' + Math.floor(Math.random()*10000), playName: det.name, name: `${det.name}.png`, dataUrl, note: det.excerpt };
              diagrams.unshift(entry);
              saveDiagrams();
            } catch (e) {
              console.warn('Failed to save diagram entry', e);
            }

            playsFound.push({
              name: det.name,
              offensiveFormation: 'Various',
              offensivePlay: 'Various',
              defensiveFormation: '4-2-5',
              coverage: det.name,
              blitz: 'Varies',
              note: det.excerpt,
              keyReads: [],
              responsibilities: { Mike: 'TBD', Will: 'TBD' },
              defResponsibilities: {},
              diagram: dataUrl
            });
          }

          if (playsFound.length === 0) {
            let fullText = '';
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              fullText += content.items.map(it => it.str).join(' ') + '\n\n';
            }
            playsFound.push({
              name: 'Imported Playbook',
              offensiveFormation: 'Various',
              offensivePlay: 'Various',
              defensiveFormation: '4-2-5',
              coverage: 'Mixed',
              blitz: 'Varies',
              note: fullText.substring(0,2000),
              keyReads: [],
              responsibilities: { Mike: 'TBD', Will: 'TBD' },
              defResponsibilities: {},
              diagram: ''
            });
          }

            // Try to run the heuristic parser on the full text and map diagrams to parsed plays
            try {
              let fullTextAll = '';
              for (let pi = 1; pi <= pdf.numPages; pi++) {
                const page = await pdf.getPage(pi);
                const content = await page.getTextContent();
                fullTextAll += content.items.map(it => it.str).join(' ') + '\n\n';
              }
              const parsedPlays = parsePlaysFromText(fullTextAll);
              if (parsedPlays && parsedPlays.length) {
                // map detected diagrams to parsed plays by name/coverage
                parsedPlays.forEach(pp => {
                  const match = playsFound.find(d => (d.name || '').toLowerCase().includes((pp.name||'').toLowerCase()) || (d.coverage||'').toLowerCase().includes((pp.coverage||'').toLowerCase()));
                  if (match) pp.diagram = match.diagram || '';
                });
                // prefer parsedPlays for preview/import
                showImportPreview(parsedPlays);
                return;
              }
            } catch (e) {
              console.warn('Parser mapping failed', e);
            }

          plays = plays.concat(playsFound);
          populatePlayList();
          populateDiagramSelect();
          recordPromptLog('import_pdf', `Imported ${playsFound.length} plays from PDF (with images)`);
          toast(`Imported ${playsFound.length} plays from PDF.`, { type: 'success' });
          hideStatus();
        } catch (err) {
          console.error(err);
          toast('Failed to parse PDF: ' + (err && err.message ? err.message : err), { type: 'error' });
          hideStatus();
        }
        return;
      }

      // JSON/text import path
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data.plays) || Array.isArray(data)) {
            plays = data.plays || data;
            populatePlayList();
            recordPromptLog("import_playbook", `Imported ${plays.length} plays from file`);
          } else {
            toast('JSON format not recognized. Expecting { plays: [...] } or an array.', { type: 'error' });
          }
        } catch (err) {
          toast('Failed to parse JSON: ' + err.message, { type: 'error' });
        }
      };
      reader.readAsText(f);
  });
}

function wirePlayFormHandlers() {
  console.log('wirePlayFormHandlers called');
  try {
    const savePlaysBtn = document.getElementById("savePlaysButton");
    const addPlayBtn = document.getElementById("addPlayButton");
    const submitBtn = document.getElementById("submitPlayButton");
    const cancelBtn = document.getElementById("cancelPlayButton");
    
    console.log('Buttons found:', { savePlaysBtn, addPlayBtn, submitBtn, cancelBtn });
  
  if (savePlaysBtn) {
    savePlaysBtn.addEventListener("click", () => {
      console.log('Save Plays clicked');
      localStorage.setItem("plays", JSON.stringify(plays));
      toast('Plays saved to browser localStorage.', { type: 'success' });
    });
  }

  if (addPlayBtn) {
    addPlayBtn.addEventListener("click", () => {
      console.log('Add Play button clicked');
      document.getElementById("addPlayForm").classList.remove("hidden");
      window.isEditingPlay = false;
      window.editPlayIndex = null;
    });
  }

  if (submitBtn) {
    submitBtn.addEventListener("click", () => {
      console.log('Submit Play clicked');
      const name = document.getElementById("playName").value.trim();
      const offensiveFormation = document.getElementById("playOffensiveFormation").value.trim();
      const offensivePlay = document.getElementById("playOffensivePlay").value.trim();
      const defensiveFormation = document.getElementById("playDefensiveFormation").value.trim();
      const coverage = document.getElementById("playCoverage").value.trim();
      const blitz = document.getElementById("playBlitz").value.trim();
      const note = document.getElementById("playNote").value.trim();
      const keyReads = document.getElementById("playKeyReads").value.trim().split(",").map(x => x.trim()).filter(Boolean);
      const mikeResp = document.getElementById("playMikeResp").value.trim();
      const willResp = document.getElementById("playWillResp").value.trim();

      if (!name) {
        toast('Play name is required.', { type: 'warn' });
        return;
      }

      const updatedPlay = {
        name,
        offensiveFormation: offensiveFormation || "Unknown",
        offensivePlay: offensivePlay || "Unknown",
        defensiveFormation: defensiveFormation || "Unknown",
        coverage: coverage || "N/A",
        blitz: blitz || "None",
        note: note || "-",
        keyReads: keyReads.length > 0 ? keyReads : [],
        responsibilities: {
          Mike: mikeResp || "TBD",
          Will: willResp || "TBD"
        },
        defResponsibilities: {},
        diagram: ""
      };

      if (window.isEditingPlay && typeof window.editPlayIndex === "number" && window.editPlayIndex >= 0) {
        plays[window.editPlayIndex] = updatedPlay;
        recordPromptLog("edit_play", `Edited play: ${name}`);
      } else {
        plays.push(updatedPlay);
        recordPromptLog("add_play", `Added new play: ${name}`);
      }
      populatePlayList();
      populateDiagramSelect();

      // Clear form and hide it
      document.getElementById("playName").value = "";
      document.getElementById("playOffensiveFormation").value = "";
      document.getElementById("playOffensivePlay").value = "";
      document.getElementById("playDefensiveFormation").value = "";
      document.getElementById("playCoverage").value = "";
      document.getElementById("playBlitz").value = "";
      document.getElementById("playNote").value = "";
      document.getElementById("playKeyReads").value = "";
      document.getElementById("playMikeResp").value = "";
      document.getElementById("playWillResp").value = "";
      document.getElementById("addPlayForm").classList.add("hidden");
      window.isEditingPlay = false;
      window.editPlayIndex = null;
      toast(`Play "${name}" saved successfully!`, { type: 'success' });
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      console.log('Cancel clicked');
      document.getElementById("addPlayForm").classList.add("hidden");
      window.isEditingPlay = false;
      window.editPlayIndex = null;
    });
  }
  } catch (err) {
    console.error('Error in wirePlayFormHandlers:', err);
  }
}

/* -- Prompt log controls -- */

function showImportPreview(parsedPlays) {
  // simple modal overlay preview for parsed plays
  const existing = document.getElementById('importPreview');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.id = 'importPreview';
  Object.assign(overlay.style, { position: 'fixed', left:0,top:0,right:0,bottom:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999 });
  const box = document.createElement('div');
  Object.assign(box.style, { width:'90%', maxWidth:'1000px', maxHeight:'80%', overflow:'auto', background:'#072029', color:'#fff', borderRadius:'8px', padding:'16px' });
  const title = document.createElement('h2'); title.textContent = 'Imported Playbook — Preview'; box.appendChild(title);
  const list = document.createElement('div');
  parsedPlays.forEach((pp, i) => {
    const card = document.createElement('div'); card.className = 'playCard'; card.style.display='flex'; card.style.alignItems='center'; card.style.marginBottom='8px';
    const left = document.createElement('div'); left.style.flex='0 0 160px';
    if (pp.diagram) { const img = document.createElement('img'); img.src = pp.diagram; img.style.maxWidth='150px'; img.style.display='block'; img.style.border='1px solid #ccc'; img.style.background='#fff'; left.appendChild(img); }
    else { const ph = document.createElement('div'); ph.style.width='150px'; ph.style.height='90px'; ph.style.background='#08323f'; ph.style.display='flex'; ph.style.alignItems='center'; ph.style.justifyContent='center'; ph.textContent='No image'; left.appendChild(ph); }
    const right = document.createElement('div'); right.style.flex='1'; right.style.marginLeft='12px';
    const chk = document.createElement('input'); chk.type='checkbox'; chk.checked = true; chk.id = `imp_chk_${i}`;
    const lbl = document.createElement('label'); lbl.htmlFor = chk.id; lbl.style.fontWeight='700'; lbl.style.marginLeft='8px'; lbl.textContent = pp.name || `Play ${i+1}`;
    const meta = document.createElement('div'); meta.style.fontSize='13px'; meta.style.opacity='0.9'; meta.textContent = `${pp.offensiveFormation || ''} • ${pp.coverage || ''} • ${pp.blitz || ''}`;
    const note = document.createElement('p'); note.style.fontSize='12px'; note.style.opacity='0.85'; note.textContent = pp.note || '';
    right.appendChild(chk); right.appendChild(lbl); right.appendChild(meta); right.appendChild(note);
    card.appendChild(left); card.appendChild(right); list.appendChild(card);
  });
  box.appendChild(list);
  const actions = document.createElement('div'); actions.style.textAlign='right'; actions.style.marginTop='8px';
  const cancel = document.createElement('button'); cancel.textContent='Cancel'; cancel.style.marginRight='8px';
  const confirm = document.createElement('button'); confirm.textContent='Import Selected'; confirm.style.background='#16a085'; confirm.style.color='#fff'; confirm.style.border='none'; confirm.style.padding='8px 12px'; confirm.style.borderRadius='6px';
  actions.appendChild(cancel); actions.appendChild(confirm); box.appendChild(actions);
  cancel.addEventListener('click', () => overlay.remove());
  confirm.addEventListener('click', () => {
    const selected = [];
    parsedPlays.forEach((pp, i) => { const chk = document.getElementById(`imp_chk_${i}`); if (chk && chk.checked) selected.push(pp); });
    if (selected.length) {
      selected.forEach(sp => {
        plays.push(sp);
        if (sp.diagram) {
          diagrams.unshift({ id: Date.now().toString() + '-' + Math.floor(Math.random()*10000), playName: sp.name, name: `${sp.name}.png`, dataUrl: sp.diagram, note: sp.note });
        }
      });
      saveDiagrams();
      populatePlayList();
      populateDiagramSelect();
      recordPromptLog('import_pdf_confirm', `Imported ${selected.length} plays (confirmed)`);
    }
    overlay.remove();
    toast(`Imported ${selected.length} plays.`, { type: 'success' });
  });
  overlay.appendChild(box); document.body.appendChild(overlay);
}

function saveDiagrams() {
  try {
    localStorage.setItem('diagrams', JSON.stringify(diagrams));
  } catch (e) { console.warn('Could not save diagrams', e); }
}

function populateDiagramSelect() {
  const sel = document.getElementById('playSelectForDiagram');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">-- Select play to tag diagram --</option>';
  plays.forEach(p => {
    const opt = document.createElement('option'); opt.value = p.name; opt.textContent = p.name; sel.appendChild(opt);
  });
  if (current) sel.value = current;
}

function populateDiagramGallery() {
  const gallery = document.getElementById("diagramGallery");
  if (!gallery) return;
  gallery.innerHTML = "";
  // include static diagrams referenced in plays.json first
  const staticDiagrams = plays.filter((p) => p.diagram).map((p) => ({
    id: `static-${p.name}`,
    playName: p.name,
    name: p.diagram.split('/').pop(),
    dataUrl: p.diagram,
    static: true,
  }));
  const combined = [...staticDiagrams, ...diagrams];
  if (!combined.length) {
    gallery.innerHTML = "<p>No diagrams available.</p>";
    return;
  }
  combined.forEach((d) => {
    const card = document.createElement("div");
    card.className = "playCard";
    const img = document.createElement("img");
    img.src = d.dataUrl;
    img.alt = d.name;
    img.className = "diagram-gallery-image";
    img.style.display = "block";
    img.addEventListener("click", () => openLightbox(img.src));
    const info = document.createElement("div");
    info.innerHTML = `<strong>${d.name}</strong> — tagged to <em>${d.playName}</em>`;
    card.appendChild(img);
    card.appendChild(info);
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.addEventListener("click", () => {
      if (!confirm("Delete this diagram?")) return;
      if (d.static) {
        // For static diagrams, remove from plays
        plays = plays.map((p) => {
          if (p.name === d.playName) {
            p.diagram = null;
          }
          return p;
        });
        localStorage.setItem("plays", JSON.stringify(plays));
      } else {
        // For user-uploaded diagrams, remove from diagrams array
        diagrams = diagrams.filter((x) => x.id !== d.id);
        saveDiagrams();
      }
      populateDiagramGallery();
      populatePlayList();
      toast('Diagram deleted.', { type: 'success' });
    });
    card.appendChild(del);
    gallery.appendChild(card);
  });
}

function renderCard() {
  const front = document.getElementById("cardFront");
  const back = document.getElementById("cardBack");
  if (!cards.length) {
    front.textContent = "No flashcards. Generate flashcards from plays.";
    back.textContent = "";
    return;
  }
  const card = cards[currentCard];
  front.textContent = `${currentCard + 1}. ${card.q}`;
  back.textContent = `${card.a}\n\n${card.explanation}`;
  document.getElementById("card").classList.remove("flipped");
  front.classList.remove("hidden");
  back.classList.add("hidden");
}

function flipCard() {
  const cardEl = document.getElementById("card");
  cardEl.classList.toggle("flipped");
  document.getElementById("cardFront").classList.toggle("hidden");
  document.getElementById("cardBack").classList.toggle("hidden");
}

function nextCard() {
  if (!cards.length) return;
  currentCard = (currentCard + 1) % cards.length;
  renderCard();
}

function prevCard() {
  if (!cards.length) return;
  currentCard = (currentCard - 1 + cards.length) % cards.length;
  renderCard();
}

function uploadDiagram() {
  const fileEl = document.getElementById("diagramFile");
  const sel = document.getElementById("playSelectForDiagram");
  if (!fileEl || !fileEl.files[0]) return toast('Choose an image to upload.', { type: 'warn' });
  const playName = sel ? sel.value : null;
  if (!playName) return toast('Select the play to tag this diagram to.', { type: 'warn' });
  const f = fileEl.files[0];
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    const entry = { id: Date.now().toString(), playName, name: f.name, dataUrl, note: "" };
    diagrams.unshift(entry);
    saveDiagrams();
    populateDiagramGallery();
    populatePlayList();
    recordPromptLog("upload_diagram", `Uploaded diagram ${f.name} for ${playName}`);
    fileEl.value = null;
  };
  reader.readAsDataURL(f);
}
function wirePromptControls() {
  document.getElementById("downloadLog").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(promptLog, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prompt_log.json";
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("clearLog").addEventListener("click", () => {
    if (!confirm("Clear the prompt log?")) return;
    promptLog = [];
    localStorage.removeItem("promptLog");
    updatePromptList();
  });
}

/* -- Export plays and diagrams to files -- */
function exportPlaysToFile() {
  const dataToSave = {
    plays: plays,
    diagrams: diagrams,
    exportDate: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `playbook_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Playbook exported successfully!', { type: 'success' });
  recordPromptLog("export_playbook", `Exported ${plays.length} plays and ${diagrams.length} diagrams`);
}

/* -- Ready -- */
document.addEventListener("DOMContentLoaded", () => {
  console.log('Digital Playbook Coach: script loaded, DOMContentLoaded fired');
  initNav();
  loadPlays().then(() => {
    // show loaded or saved plays
    const saved = localStorage.getItem("plays");
    if (saved && !plays.length) {
      try {
        plays = JSON.parse(saved);
        populatePlayList();
      } catch (e) {}
    }
  });
  document.getElementById("genFlashcards").addEventListener("click", generateFlashcardsFromPlays);
  document.getElementById("flipCard").addEventListener("click", flipCard);
  document.getElementById("nextCard").addEventListener("click", nextCard);
  document.getElementById("prevCard").addEventListener("click", prevCard);
  document.getElementById("startQuiz").addEventListener("click", startQuiz);
  document.getElementById("startScenario").addEventListener("click", startScenario);
  const aiBtn = document.getElementById("startScenarioAI");
  if (aiBtn) aiBtn.addEventListener("click", startScenarioAI);
  // Import functionality removed from startup to avoid heavy processing.
  // wireImport();
  wirePromptControls();
  try {
    wirePlayFormHandlers();
  } catch (err) {
    console.error('Error wiring play form handlers:', err);
  }
  // Wire export button
  const exportBtn = document.getElementById("exportPlaysButton");
  if (exportBtn) exportBtn.addEventListener("click", exportPlaysToFile);
  // diagram handlers
  const uploadBtn = document.getElementById("uploadDiagram");
  if (uploadBtn) uploadBtn.addEventListener("click", uploadDiagram);
  // lightbox handlers
  const lbClose = document.getElementById("lightboxClose");
  if (lbClose) lbClose.addEventListener("click", closeLightbox);
  const lb = document.getElementById("lightbox");
  if (lb) {
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeLightbox();
    });
  }
  updatePromptList();
});

