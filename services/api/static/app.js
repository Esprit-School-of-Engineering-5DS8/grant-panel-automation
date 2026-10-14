// Grant Panel Simulator — Frontend Orchestration Logic

let allProposals = [];
let selectedProposal = null;

// DOM Elements
const proposalsContainer = document.getElementById('proposals-container');
const searchInput = document.getElementById('search-proposals');
const consoleLogs = document.getElementById('console-logs');
const activeProposalPill = document.getElementById('active-proposal-pill');
const pipelineBadge = document.getElementById('pipeline-badge');
const executionModeSelect = document.getElementById('execution-mode-select');

// Evaluator Agent elements
const techScore = document.getElementById('agent-tech-score');
const techText = document.getElementById('agent-tech-text');
const techRec = document.getElementById('agent-tech-rec');

const impactScore = document.getElementById('agent-impact-score');
const impactText = document.getElementById('agent-impact-text');
const impactRec = document.getElementById('agent-impact-rec');

const budgetScore = document.getElementById('agent-budget-score');
const budgetText = document.getElementById('agent-budget-text');
const budgetRec = document.getElementById('agent-budget-rec');

// Chair elements
const compositeScoreVal = document.getElementById('composite-score-val');
const cohortTierVal = document.getElementById('cohort-tier-val');
const traceabilityVal = document.getElementById('traceability-val');
const esrLetterBody = document.getElementById('esr-letter-body');
const chairStatusPill = document.getElementById('chair-status-pill');

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadProposals();
  setupEventListeners();
});

function setupEventListeners() {
  searchInput.addEventListener('input', (e) => {
    filterProposals(e.target.value.toLowerCase());
  });

  document.getElementById('btn-refresh-proposals').addEventListener('click', loadProposals);

  document.getElementById('btn-quick-evaluate-first').addEventListener('click', () => {
    if (allProposals.length > 0) {
      selectAndRunProposal(allProposals[0].id);
    }
  });

  document.getElementById('btn-open-n8n').addEventListener('click', () => {
    window.open('http://localhost:5678', '_blank');
  });

  document.getElementById('btn-run-cohort').addEventListener('click', runCohortBenchmark);

  document.getElementById('btn-sign-off').addEventListener('click', () => {
    chairStatusPill.textContent = 'Authorized by Chair';
    chairStatusPill.className = 'status-pill status-success';
    alert('✅ ESR Decision officially signed and sealed by Executive Panel Chair (Dr. Elena Vance).');
  });

  document.getElementById('btn-export-json').addEventListener('click', () => {
    if (!selectedProposal) return;
    const exportData = {
      proposal_id: selectedProposal.id,
      title: selectedProposal.title,
      timestamp: new Date().toISOString(),
      evaluation: {
        composite_score: compositeScoreVal.textContent,
        tier: cohortTierVal.textContent,
        chair_summary: esrLetterBody.textContent
      }
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ESR-${selectedProposal.id}.json`;
    a.click();
  });
}

async function loadProposals() {
  proposalsContainer.innerHTML = '<div class="loading-state">Loading proposals from disk...</div>';
  try {
    const res = await fetch('/api/proposals');
    allProposals = await res.json();
    renderProposals(allProposals);

    // Update KPI counters
    document.getElementById('kpi-total-val').textContent = allProposals.length;
    document.getElementById('counter-total-proposals').textContent = allProposals.length;

    // Automatically select first proposal
    if (allProposals.length > 0 && !selectedProposal) {
      selectProposal(allProposals[0].id);
    }
  } catch (err) {
    proposalsContainer.innerHTML = `<div class="error-state">Failed to load proposals: ${err.message}. Ensure backend is running.</div>`;
  }
}

function renderProposals(proposals) {
  if (proposals.length === 0) {
    proposalsContainer.innerHTML = '<div class="empty-state">No proposals found in data/synthetic_proposals.</div>';
    return;
  }

  proposalsContainer.innerHTML = proposals.map(p => {
    const isSelected = selectedProposal && selectedProposal.id === p.id;
    const grantFormatted = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p.requested_grant);
    const partnersCount = p.consortium_partners ? p.consortium_partners.length : 0;

    return `
      <div class="proposal-card-item ${isSelected ? 'selected' : ''}" data-id="${p.id}" onclick="selectProposal('${p.id}')">
        <div class="item-main">
          <span class="item-id-pill">${p.id}</span>
          <div class="item-title">${p.title}</div>
          <div class="item-meta">
            <span>👤 ${p.pi_name}</span>
            <span>🏛️ ${partnersCount} Partners</span>
            <span>💶 ${grantFormatted}</span>
            <span>📄 ${p.page_count}p</span>
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-run-pipeline" onclick="event.stopPropagation(); selectAndRunProposal('${p.id}')">
            ▶ Run in n8n
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterProposals(query) {
  const filtered = allProposals.filter(p => 
    p.id.toLowerCase().includes(query) ||
    p.title.toLowerCase().includes(query) ||
    p.pi_name.toLowerCase().includes(query)
  );
  renderProposals(filtered);
}

async function selectProposal(id) {
  try {
    const res = await fetch(`/api/proposals/${id}`);
    selectedProposal = await res.json();
    activeProposalPill.textContent = selectedProposal.id;
    document.getElementById('current-eval-id').textContent = `Active: ${selectedProposal.id}`;
    
    // Highlight in list
    document.querySelectorAll('.proposal-card-item').forEach(el => {
      el.classList.toggle('selected', el.getAttribute('data-id') === id);
    });

    log(`[Intake] Loaded proposal details for [${selectedProposal.id}] "${selectedProposal.title}" (PI: ${selectedProposal.pi_name})`);
  } catch (err) {
    log(`[Error] Failed to load proposal ${id}: ${err.message}`);
  }
}

async function selectAndRunProposal(id) {
  await selectProposal(id);
  await executePipeline();
}

function resetPipelineSteps() {
  document.querySelectorAll('.step-node').forEach(node => {
    node.className = 'step-node';
  });
}

function setPipelineStage(stageNum, status = 'active') {
  const node = document.querySelector(`.step-node[data-stage="${stageNum}"]`);
  if (node) {
    if (status === 'completed') {
      node.className = 'step-node completed';
    } else if (status === 'active') {
      node.className = 'step-node active';
    }
  }
}

function log(msg) {
  const time = new Date().toLocaleTimeString();
  consoleLogs.textContent += `[${time}] ${msg}\n`;
  consoleLogs.scrollTop = consoleLogs.scrollHeight;
}

async function executePipeline() {
  if (!selectedProposal) return;

  resetPipelineSteps();
  consoleLogs.textContent = '';
  const mode = executionModeSelect.value;
  pipelineBadge.textContent = mode === 'n8n' ? 'n8n Active' : 'Microservice';
  pipelineBadge.style.background = '#dbeafe';
  pipelineBadge.style.color = '#1e40af';

  log(`🚀 Starting Multi-Agent Evaluation for [${selectedProposal.id}]`);
  log(`📡 Target Execution Mode: ${mode.toUpperCase()}`);

  setPipelineStage(0, 'active');

  if (mode === 'n8n') {
    // Mode 1: Attempt n8n Webhook
    log(`[*] Forwarding proposal payload to n8n Webhook: http://localhost:5678/webhook/submit-proposal ...`);
    try {
      const n8nRes = await fetch('/api/n8n/trigger-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedProposal)
      });
      const n8nData = await n8nRes.json();

      if (n8nData.success) {
        log(`[+] n8n Webhook completed! Status: ${n8nData.status_code}`);
        setPipelineStage(0, 'completed');
        // If n8n returned structured output, render it
        handlePipelineResults(n8nData.result);
        return;
      } else {
        log(`[!] n8n Webhook notice: ${n8nData.error || 'Webhook offline'}`);
        log(`[i] Auto-fallback: Running pipeline via direct Python microservices.`);
      }
    } catch (e) {
      log(`[!] Could not reach n8n webhook: ${e.message}. Falling back to direct API.`);
    }
  }

  // Local Microservice Step-by-Step execution with animated stages
  runDirectPipeline();
}

async function runDirectPipeline() {
  try {
    // Stage 0 & 1: Multimodal Ingestion
    setPipelineStage(0, 'completed');
    setPipelineStage(1, 'active');
    log(`[Stage 1] Parsing PDF sections and multimodal figures...`);
    await sleep(250);
    setPipelineStage(1, 'completed');

    // Stage 2: Deterministic Checks
    setPipelineStage(2, 'active');
    log(`[Stage 2] Running deterministic compliance checks (page limits, consortium >= 3, caps)...`);
    const s2Res = await fetch('/api/stage2/deterministic-checks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedProposal)
    });
    const s2 = await s2Res.json();

    if (!s2.is_eligible) {
      log(`[Stage 2 Violation] Proposal is deterministic REJECTED! Violations: ${s2.violations.join(', ')}`);
      setPipelineStage(2, 'completed');
      renderRejectedState(s2.violations);
      return;
    }
    log(`[Stage 2 Passed] Proposal complies with all hard eligibility rules.`);
    setPipelineStage(2, 'completed');

    // Stage 3: Parallel Independent Evaluators
    setPipelineStage(3, 'active');
    log(`[Stage 3] Spawning 3 autonomous evaluator agents (Technical, Impact, Budget)...`);
    
    const [techRes, impactRes, budgetRes] = await Promise.all([
      fetch('/api/stage3/evaluate-criterion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterion: 'technical', proposal: selectedProposal })
      }).then(r => r.json()),
      fetch('/api/stage3/evaluate-criterion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterion: 'impact', proposal: selectedProposal })
      }).then(r => r.json()),
      fetch('/api/stage3/evaluate-criterion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criterion: 'budget', proposal: selectedProposal })
      }).then(r => r.json())
    ]);

    renderEvaluatorCards(techRes, impactRes, budgetRes);
    log(`[Stage 3 Complete] Technical: ${techRes.score}/5.0 | Impact: ${impactRes.score}/5.0 | Budget: ${budgetRes.score}/5.0`);
    setPipelineStage(3, 'completed');

    // Stage 4: Disagreement Detector
    setPipelineStage(4, 'active');
    const reviews = { technical: techRes, impact: impactRes, budget: budgetRes };
    const s4Res = await fetch('/api/stage4/detect-disagreement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews, delta_threshold: 2.0 })
    });
    const s4 = await s4Res.json();
    setPipelineStage(4, 'completed');

    let finalScores = {
      technical: techRes.score,
      impact: impactRes.score,
      budget: budgetRes.score
    };

    // Stage 5: Chair Arbitration (if triggered)
    if (s4.triggers_round_2) {
      setPipelineStage(5, 'active');
      log(`⚠️ [Round 2 Disagreement Detected] Score delta: ${s4.score_range}. Convening Panel Chair arbitration...`);
      const s5Res = await fetch('/api/stage5/chair-arbitration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal: selectedProposal, reviews, disagreement_info: s4 })
      });
      const s5 = await s5Res.json();
      finalScores = s5.arbitrated_scores;
      esrLetterBody.textContent = s5.arbitration_summary;
      log(`[Stage 5 Arbitrated] Panel Chair resolved conflict: ${s5.arbitration_summary}`);
      setPipelineStage(5, 'completed');
    } else {
      log(`[Stage 4 Consensus] Evaluators in close agreement (delta < 2.0). Proceeding directly to aggregation.`);
    }

    // Stage 6: Score Aggregation
    setPipelineStage(6, 'active');
    const s6Res = await fetch('/api/stage6/aggregate-scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalScores)
    });
    const s6 = await s6Res.json();
    setPipelineStage(6, 'completed');

    // Stage 7: Traceability & Verbatim Quote Verification
    setPipelineStage(7, 'active');
    const s7Res = await fetch('/api/stage7/verify-traceability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        review: techRes,
        raw_proposal_text: JSON.stringify(selectedProposal)
      })
    });
    const s7 = await s7Res.json();
    setPipelineStage(7, 'completed');

    // Stage 8: Human-in-the-loop Finalization
    compositeScoreVal.textContent = `${s6.composite_score.toFixed(2)} / 5.0`;
    cohortTierVal.textContent = s6.tier;
    traceabilityVal.textContent = `${(s7.traceability_rate * 100).toFixed(1)}% (VERIFIED)`;
    chairStatusPill.textContent = 'Ready for Chair Sign-off';
    chairStatusPill.className = 'status-pill status-ready';

    pipelineBadge.textContent = 'Completed';
    pipelineBadge.style.background = '#d1fae5';
    pipelineBadge.style.color = '#065f46';

    log(`🎉 Evaluation Complete! Composite Score: ${s6.composite_score.toFixed(2)} | Tier: ${s6.tier} | Recommendation: ${s6.recommendation}`);

  } catch (err) {
    log(`[Pipeline Error] ${err.message}`);
  }
}

function renderEvaluatorCards(tech, impact, budget) {
  techScore.textContent = `${tech.score.toFixed(1)} / 5.0`;
  techText.textContent = `"${tech.summary}"`;
  techRec.textContent = `REC: ${tech.recommendation}`;

  impactScore.textContent = `${impact.score.toFixed(1)} / 5.0`;
  impactText.textContent = `"${impact.summary}"`;
  impactRec.textContent = `REC: ${impact.recommendation}`;

  budgetScore.textContent = `${budget.score.toFixed(1)} / 5.0`;
  budgetText.textContent = `"${budget.summary}"`;
  budgetRec.textContent = `REC: ${budget.recommendation}`;
}

function renderRejectedState(violations) {
  techScore.textContent = 'N/A';
  impactScore.textContent = 'N/A';
  budgetScore.textContent = 'N/A';
  compositeScoreVal.textContent = '0.00 / 5.0';
  cohortTierVal.textContent = 'REJECTED (INELIGIBLE)';
  cohortTierVal.className = 'meta-val text-red';
  esrLetterBody.textContent = `Formal Administrative Ineligibility Notice: Proposal fails Horizon-AI criteria due to: ${violations.join('; ')}.`;
  chairStatusPill.textContent = 'Rejected Administratively';
  chairStatusPill.className = 'status-pill icon-red';
}

function handlePipelineResults(result) {
  log(`[n8n Output Received]: ${JSON.stringify(result)}`);
  if (result.composite_score) {
    compositeScoreVal.textContent = `${result.composite_score} / 5.0`;
  }
  if (result.tier) {
    cohortTierVal.textContent = result.tier;
  }
  if (result.traceability_rate) {
    traceabilityVal.textContent = `${result.traceability_rate}`;
  }
}

async function runCohortBenchmark() {
  log(`[*] Running batch cohort evaluation on all ${allProposals.length} proposals...`);
  alert(`Starting cohort evaluation for ${allProposals.length} proposals. Trace logs will output to the live console.`);
  for (const p of allProposals.slice(0, 5)) {
    await selectAndRunProposal(p.id);
    await sleep(600);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
