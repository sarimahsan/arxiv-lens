import { useState, useEffect, useRef } from "react";

// ─── API ───────────────────────────────────────────────────────
const API = "http://localhost:8000";
async function analyzePaper(arxivId) {
  const res = await fetch(`${API}/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arxiv_id: arxivId }) });
  if (!res.ok) throw new Error((await res.json()).detail || "Analysis failed");
  return res.json();
}
async function chatWithPaper(arxivId, question) {
  const res = await fetch(`${API}/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arxiv_id: arxivId, question }) });
  if (!res.ok) throw new Error((await res.json()).detail || "Chat failed");
  return res.json();
}

// ─── Subtle Particle Canvas (light red/rose tones) ────────────
function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const pts = Array.from({ length: 35 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.2 + 0.3, vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18, a: Math.random() * 0.18 + 0.04 }));
    let raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(185,28,28,${p.a})`; ctx.fill(); });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < 100) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `rgba(185,28,28,${0.04 * (1 - d / 100)})`; ctx.lineWidth = 0.5; ctx.stroke(); } }
      raf = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.45 }} />;
}

// ─── Enhanced Citation Graph with Animated Flowing Links ─────────────────────
function CitationGraph({ graph, onNodeClick }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const hoveredRef = useRef(null);
  const particleOffsetRef = useRef(0); // For flowing particle animation on links

  useEffect(() => {
    if (!graph?.nodes?.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth; const H = canvas.offsetHeight;
    canvas.width = W; canvas.height = H;
    const FONT_MAIN = "bold 11px 'Inter', sans-serif";
    const FONT_REF = "10px 'Inter', sans-serif";
    
    // Initialize nodes with positions (better distribution)
    const centerX = W / 2;
    const centerY = H / 2;
    const radius = Math.min(W, H) * 0.35;
    
    nodesRef.current = graph.nodes.map((n, idx) => {
      // Position nodes in a circle-ish layout initially, main node at center
      let x, y;
      if (n.type === "main") {
        x = centerX;
        y = centerY;
      } else {
        const angle = (idx / (graph.nodes.length - 1)) * Math.PI * 2;
        x = centerX + Math.cos(angle) * radius * (0.6 + Math.random() * 0.4);
        y = centerY + Math.sin(angle) * radius * (0.6 + Math.random() * 0.4);
      }
      return { ...n, x, y, vx: 0, vy: 0, radius: n.type === "main" ? 16 : 10 };
    });
    
    linksRef.current = graph.links || [];
    const nodeMap = {};
    nodesRef.current.forEach((n) => (nodeMap[n.id] = n));
    let t = 0;
    
    // Force simulation parameters
    const REPULSION_STRENGTH = 1800;
    const LINK_STRENGTH = 0.025;
    const LINK_DISTANCE = 130;
    const CENTER_STRENGTH = 0.003;
    const DAMPING = 0.88;

    function tick() {
      t++;
      const nodes = nodesRef.current;
      const links = linksRef.current;
      
      // Repulsion forces between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION_STRENGTH / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          nodes[i].vx -= fx;
          nodes[i].vy -= fy;
          nodes[j].vx += fx;
          nodes[j].vy += fy;
        }
      }
      
      // Link forces (springs)
      links.forEach((l) => {
        const s = nodeMap[l.source];
        const t2 = nodeMap[l.target];
        if (!s || !t2) return;
        const dx = t2.x - s.x;
        const dy = t2.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const delta = dist - LINK_DISTANCE;
        const fx = (dx / dist) * delta * LINK_STRENGTH;
        const fy = (dy / dist) * delta * LINK_STRENGTH;
        s.vx += fx;
        s.vy += fy;
        t2.vx -= fx;
        t2.vy -= fy;
      });
      
      // Center attraction and damping
      nodes.forEach((n) => {
        n.vx += (centerX - n.x) * CENTER_STRENGTH;
        n.vy += (centerY - n.y) * CENTER_STRENGTH;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        // Keep nodes within bounds with padding
        n.x = Math.max(25, Math.min(W - 25, n.x));
        n.y = Math.max(25, Math.min(H - 25, n.y));
      });
      
      // Update particle offset for flowing animation
      particleOffsetRef.current = (particleOffsetRef.current + 0.012) % 1;
      
      ctx.clearRect(0, 0, W, H);
      
      // ─── 1. Draw GLOW LINKS (gradient lines) ──────────────────────────────
      links.forEach((l) => {
        const s = nodeMap[l.source];
        const t2 = nodeMap[l.target];
        if (!s || !t2) return;
        
        const dx = t2.x - s.x;
        const dy = t2.y - s.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 5) return;
        
        // Main gradient line — red/rose palette
        const gradient = ctx.createLinearGradient(s.x, s.y, t2.x, t2.y);
        gradient.addColorStop(0, "rgba(185, 28, 28, 0.55)");
        gradient.addColorStop(0.5, "rgba(220, 38, 38, 0.7)");
        gradient.addColorStop(1, "rgba(185, 28, 28, 0.55)");
        
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.8;
        ctx.shadowBlur = 5;
        ctx.shadowColor = "rgba(185, 28, 28, 0.3)";
        ctx.stroke();
        
        // Outer glow (softer)
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.strokeStyle = "rgba(220, 38, 38, 0.1)";
        ctx.lineWidth = 4;
        ctx.shadowBlur = 8;
        ctx.stroke();
        
        // ─── 2. ANIMATED FLOWING PARTICLES ALONG LINKS ─────────────────────
        const numParticles = Math.max(2, Math.floor(length / 35));
        for (let i = 0; i < numParticles; i++) {
          // Phase offset based on particle index and time
          const phase = (particleOffsetRef.current + i / numParticles) % 1;
          const px = s.x + dx * phase;
          const py = s.y + dy * phase;
          
          // Size varies with position for trailing effect
          const particleSize = 2.2 * (1 - phase * 0.3);
          const alpha = 0.65 * (1 - Math.abs(phase - 0.5) * 1.2);
          
          ctx.beginPath();
          ctx.arc(px, py, particleSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
          ctx.fill();
          
          // Inner core — red tint
          ctx.beginPath();
          ctx.arc(px, py, particleSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 38, 38, ${alpha})`;
          ctx.fill();
        }
      });
      
      // Reset shadow for nodes
      ctx.shadowBlur = 0;
      
      // ─── 3. Draw NODES with enhanced glow and depth ───────────────────────
      nodes.forEach((n) => {
        const isMain = n.type === "main";
        const isHover = hoveredRef.current === n.id;
        const baseRadius = n.radius;
        const pulse = isMain ? Math.sin(t * 0.045) * 2 : (isHover ? 2 : 0);
        const radius = baseRadius + pulse;
        
        // Outer aura glow — red palette
        const auraGradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 2.5);
        auraGradient.addColorStop(0, isMain ? "rgba(220, 38, 38, 0.25)" : isHover ? "rgba(185, 28, 28, 0.3)" : "rgba(220, 38, 38, 0.12)");
        auraGradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = auraGradient;
        ctx.fill();
        
        // Node body with radial gradient — red/rose palette
        const bodyGradient = ctx.createRadialGradient(
          n.x - radius * 0.25, n.y - radius * 0.25, 2,
          n.x, n.y, radius
        );
        if (isMain) {
          bodyGradient.addColorStop(0, "#f87171");
          bodyGradient.addColorStop(0.7, "#dc2626");
          bodyGradient.addColorStop(1, "#991b1b");
        } else if (isHover) {
          bodyGradient.addColorStop(0, "#fca5a5");
          bodyGradient.addColorStop(0.7, "#ef4444");
          bodyGradient.addColorStop(1, "#b91c1c");
        } else {
          bodyGradient.addColorStop(0, "#fecaca");
          bodyGradient.addColorStop(0.7, "#f87171");
          bodyGradient.addColorStop(1, "#dc2626");
        }
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = bodyGradient;
        ctx.shadowBlur = 10;
        ctx.shadowColor = isMain ? "rgba(220, 38, 38, 0.5)" : "rgba(185, 28, 28, 0.35)";
        ctx.fill();
        
        // Inner highlight (glass reflection)
        ctx.beginPath();
        ctx.arc(n.x - radius * 0.2, n.y - radius * 0.2, radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.fill();
        
        // Optional: small core sparkle for main node
        if (isMain) {
          ctx.beginPath();
          ctx.arc(n.x + radius * 0.1, n.y + radius * 0.1, radius * 0.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.fill();
        }
        
        ctx.shadowBlur = 0;
        
        // Node label
        if (isMain || isHover || radius > 12) {
          ctx.font = isMain ? FONT_MAIN : FONT_REF;
          ctx.fillStyle = isMain ? "#7f1d1d" : "#991b1b";
          ctx.shadowBlur = 0;
          const label = n.title ? n.title.slice(0, 22) + (n.title.length > 22 ? "…" : "") : n.id.slice(0, 12);
          ctx.fillText(label, n.x + radius + 6, n.y + 5);
          ctx.shadowBlur = 0;
        }
      });
      
      animRef.current = requestAnimationFrame(tick);
    }
    
    animRef.current = requestAnimationFrame(tick);
    
    // Event handlers for interaction
    function onMove(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      let found = null;
      nodesRef.current.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 8) found = n.id;
      });
      hoveredRef.current = found;
      canvas.style.cursor = found ? "pointer" : "grab";
    }
    
    function onClick(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      nodesRef.current.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < n.radius + 8 && onNodeClick) onNodeClick(n);
      });
    }
    
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [graph]);
  
  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", cursor: "grab" }} />;
}

// ─── App ───────────────────────────────────────────────────────
export default function App() {
  const [arxivId, setArxivId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paper, setPaper] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleAnalyze() {
    const id = arxivId.trim(); if (!id) return;
    setLoading(true); setError(""); setPaper(null); setMessages([]); setSelectedNode(null);
    try { const data = await analyzePaper(id); setPaper(data); setActiveTab("summary"); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleChat() {
    if (!question.trim() || !paper) return;
    const q = question.trim(); setQuestion(""); setMessages((m) => [...m, { role: "user", text: q }]); setChatLoading(true);
    try { const data = await chatWithPaper(paper.arxiv_id || arxivId, q); setMessages((m) => [...m, { role: "ai", text: data.answer }]); }
    catch (e) { setMessages((m) => [...m, { role: "ai", text: `Error: ${e.message}` }]); }
    finally { setChatLoading(false); }
  }

  return (
    <div className="root">
      <ParticleField />
      {/* Subtle warm orbs */}
      <div className="orb o1" /><div className="orb o2" />

      {/* ── HEADER ── */}
      <header className="header">
        <div className="hl">
          <svg className="logo-svg" width="36" height="36" viewBox="0 0 40 40">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dc2626"/><stop offset="100%" stopColor="#b91c1c"/></linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#dc2626" stopOpacity="0.15"/><stop offset="100%" stopColor="#991b1b" stopOpacity="0.1"/></linearGradient>
            </defs>
            <polygon points="20,3 36,12 36,28 20,37 4,28 4,12" fill="url(#g2)" stroke="url(#g1)" strokeWidth="1.5"/>
            <text x="20" y="25" textAnchor="middle" fill="#b91c1c" fontSize="13" fontFamily="serif" fontWeight="bold">Σ</text>
          </svg>
          <div>
            <div className="logo-text">Ar<span className="gx">X</span>iv <span className="gp">Lens</span></div>
            <div className="logo-sub">AI · RAG · Citation Graph · Chat</div>
          </div>
        </div>
        <div className="hr">
          <div className="online-pill"><span className="online-dot" />Connected</div>
          {["RAG","Graph","NLP","LLM"].map(b=><span key={b} className="hbadge">{b}</span>)}
        </div>
      </header>

      {/* ── SEARCH ── */}
      <div className="search-sec">
        <div className="search-glow-wrap">
          <div className="search-box">
            <span className="s-prefix"><span className="s-hex">◈</span><span className="s-txt">arXiv ID</span></span>
            <input className="s-input" placeholder="e.g. 2310.06825 — Mistral 7B" value={arxivId} onChange={e=>setArxivId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAnalyze()} />
            <button className={`s-btn${loading?" s-btn-loading":""}`} onClick={handleAnalyze} disabled={loading} aria-label={loading ? "Analyzing paper, please wait" : "Analyze paper"}>
              {loading ? <><span className="s-ring"/><span>Analyzing…</span></> : <><span>Analyze</span><span className="s-arrow">→</span></>}
            </button>
          </div>
        </div>
        {error && <div className="err-pill"><span>⚠</span>{error}</div>}
        {loading && <div className="prog-bar"><div className="prog-fill"/><div className="prog-shine"/></div>}
      </div>

      {/* ── CONTENT ── */}
      {paper && (
        <div className="content">
          {/* LEFT */}
          <div className="lcol">
            {/* Meta */}
            <div className="meta-card gc">
              <div className="meta-topline"/>
              <div className="meta-chip">● Paper Loaded</div>
              <h2 className="meta-title">{paper.title}</h2>
              <div className="meta-authors">{paper.authors?.slice(0,4).join(" · ")}{paper.authors?.length>4&&" · et al."}</div>
              <div className="meta-foot">
                <span className="meta-date">{paper.published?.slice(0,10)}</span>
                <span className="meta-id">{paper.arxiv_id||arxivId}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
              {["summary","chat"].map(tab=>(
                <button key={tab} className={`tab${activeTab===tab?" tab-on":""}`} onClick={()=>setActiveTab(tab)}>
                  <span>{tab==="summary"?"◈":"◉"}</span>
                  {tab==="summary"?"Summary":"Chat"}
                  {activeTab===tab&&<span className="tab-pip"/>}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="tab-body">
              {activeTab==="summary"&&(
                <div className="sum-panel">
                  <div className="sec-head"><span className="sec-lbl">Abstract</span><span className="sec-line"/></div>
                  <p className="abs-text">{paper.abstract}</p>
                  <div className="divfancy"><span/><span className="div-ico">◈</span><span/></div>
                  <div className="sec-head"><span className="sec-lbl">AI Synthesis</span><span className="sec-line"/></div>
                  {paper.summary?.sections?.map((s,i)=>(
                    <div key={i} className="chunk">
                      <div className="chunk-l"><span className="chunk-n">{String(i+1).padStart(2,"0")}</span><div className="chunk-line"/></div>
                      <p className="chunk-t">{s}</p>
                    </div>
                  ))}
                </div>
              )}
              {activeTab==="chat"&&(
                <div className="chat-panel">
                  <div className="chat-msgs">
                    {messages.length===0&&(
                      <div className="chat-empty">
                        <div className="ce-orb"/>
                        <div className="ce-title">Ready to assist</div>
                        <div className="ce-sub">Ask anything about the paper</div>
                        <div className="hints">
                          {["What's the main contribution?","What dataset was used?","What are the limitations?","Compare to prior work"].map(h=>(
                            <button key={h} className="hint-btn" onClick={()=>setQuestion(h)}>{h}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m,i)=>(
                      <div key={i} className={`msg${m.role==="user"?" msg-u":" msg-a"}`}>
                        <div className="msg-av">{m.role==="user"?"U":"AI"}</div>
                        <div className={`msg-bub gc${m.role==="user"?" bub-u":""}`}>{m.text}</div>
                      </div>
                    ))}
                    {chatLoading&&(
                      <div className="msg msg-a">
                        <div className="msg-av">AI</div>
                        <div className="msg-bub gc thinking"><span className="dot"/><span className="dot"/><span className="dot"/></div>
                      </div>
                    )}
                    <div ref={chatEndRef}/>
                  </div>
                  <div className="chat-in-row gc">
                    <input className="chat-in" placeholder="Ask a question about this paper…" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChat()}/>
                    <button className="send-btn" onClick={handleChat} disabled={chatLoading}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5l7 7-7 7M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - GRAPH */}
          <div className="rcol">
            <div className="graph-card gc">
              <div className="graph-hdr">
                <div className="graph-htitle"><span className="graph-ico">◎</span><span className="sec-lbl">Citation Graph</span></div>
                <div className="graph-stats">
                  <span className="gstat"><span className="gsdot main-dot"/>{paper.graph?.nodes?.filter(n=>n.type==="main").length||0} main</span>
                  <span className="gstat"><span className="gsdot ref-dot"/>{paper.graph?.nodes?.filter(n=>n.type!=="main").length||0} refs</span>
                </div>
              </div>
              <div className="graph-body">
                <CitationGraph graph={paper.graph} onNodeClick={setSelectedNode}/>
                {!paper.graph?.nodes?.length&&<div className="graph-empty"><div style={{fontSize:30,opacity:0.3}}>◎</div><div>No citation data</div></div>}
              </div>
              {selectedNode&&(
                <div className="node-tip gc">
                  <div className="nt-topline"/>
                  <div className="nt-body">
                    <div className="nt-title">{selectedNode.title||selectedNode.id}</div>
                    <div className="nt-meta">
                      <span className={`nt-type${selectedNode.type==="main"?" nt-main":" nt-ref"}`}>{selectedNode.type}</span>
                      <span className="nt-id">{selectedNode.id}</span>
                    </div>
                  </div>
                  <button className="nt-close" onClick={()=>setSelectedNode(null)}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!paper&&!loading&&(
        <div className="empty">
          <div className="empty-hero">
            <div className="rings">
              <div className="ring r1"/><div className="ring r2"/><div className="ring r3"/>
              <div className="ring-core">Σ</div>
            </div>
            <h1 className="empty-h">arXiv <span>Intelligence</span></h1>
            <p className="empty-p">Enter an arXiv paper ID to activate AI-powered analysis, summarization, and citation exploration.</p>
            <div className="ex-row">
              <span className="ex-lbl">Try:</span>
              {[["2310.06825","Mistral 7B"],["1706.03762","Attention"],["2005.11401","RAG"]].map(([id,nm])=>(
                <button key={id} className="ex-btn" onClick={()=>setArxivId(id)}>
                  <span className="ex-id">{id}</span><span className="ex-nm">{nm}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#fafafa;color:#1e293b;overflow-x:hidden}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#f1f5f9}
        ::-webkit-scrollbar-thumb{background:rgba(185,28,28,0.25);border-radius:3px}
        ::-webkit-scrollbar-thumb:hover{background:rgba(185,28,28,0.45)}

        .root{min-height:100vh;display:flex;flex-direction:column;font-family:'Inter',sans-serif;position:relative;background:linear-gradient(160deg,#ffffff 0%,#fff5f5 50%,#fffaf9 100%)}

        /* SUBTLE ORBS */
        .orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0}
        .o1{width:600px;height:600px;background:radial-gradient(circle,rgba(220,38,38,0.06),transparent);top:-200px;left:-180px;animation:oa 22s ease-in-out infinite}
        .o2{width:500px;height:500px;background:radial-gradient(circle,rgba(185,28,28,0.05),transparent);bottom:0;right:-160px;animation:ob 26s ease-in-out infinite}
        @keyframes oa{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,20px)}}
        @keyframes ob{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,-30px)}}

        /* CARD */
        .gc{background:#ffffff;border:1px solid #fecaca;box-shadow:0 1px 4px rgba(185,28,28,0.06),0 4px 16px rgba(0,0,0,0.05);position:relative;overflow:hidden}
        .gc::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#dc2626,#ef4444,#fca5a5,#ef4444,#dc2626);opacity:0.55;pointer-events:none}

        /* HEADER */
        .header{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:14px 28px;border-bottom:1px solid #fecaca;background:rgba(255,255,255,0.92);backdrop-filter:blur(12px);gap:12px;flex-wrap:wrap}
        .hl{display:flex;align-items:center;gap:13px}
        .logo-svg{transition:filter .3s}
        .logo-svg:hover{filter:drop-shadow(0 0 6px rgba(220,38,38,0.35))}
        .logo-text{font-size:20px;font-weight:700;letter-spacing:-.3px;color:#1e293b}
        .gx{color:#dc2626}
        .gp{color:#b91c1c}
        .logo-sub{font-size:10px;color:#94a3b8;letter-spacing:.8px;font-family:'JetBrains Mono',monospace;margin-top:2px}
        .hr{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .online-pill{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:10px;color:#16a34a;font-weight:500}
        .online-dot{width:6px;height:6px;background:#22c55e;border-radius:50%;animation:onPulse 2s ease infinite}
        @keyframes onPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.85)}}
        .hbadge{font-size:10px;padding:3px 9px;border-radius:5px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-weight:500;font-family:'JetBrains Mono',monospace}

        /* SEARCH */
        .search-sec{padding:20px 28px 14px;position:relative;z-index:5}
        .search-glow-wrap{position:relative}
        .search-glow-wrap::after{content:'';position:absolute;inset:-2px;border-radius:15px;background:linear-gradient(135deg,rgba(220,38,38,0.12),rgba(185,28,28,0.08));opacity:0;transition:opacity .3s;pointer-events:none;border-radius:14px}
        .search-glow-wrap:focus-within::after{opacity:1}
        .search-box{display:flex;align-items:stretch;background:#ffffff;border:1.5px solid #e2e8f0;border-radius:12px;overflow:hidden;transition:border-color .25s,box-shadow .25s}
        .search-box:focus-within{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,0.1)}
        .s-prefix{display:flex;align-items:center;gap:8px;padding:0 16px;border-right:1.5px solid #f1f5f9;white-space:nowrap;background:#fafafa}
        .s-hex{font-size:14px;color:#dc2626}
        .s-txt{font-size:11px;color:#94a3b8;font-family:'JetBrains Mono',monospace;font-weight:500}
        .s-input{flex:1;background:transparent;border:none;outline:none;color:#1e293b;font-family:'Inter',sans-serif;font-size:14px;padding:14px 16px;min-width:0}
        .s-input::placeholder{color:#cbd5e1}
        .s-btn{display:flex;align-items:center;justify-content:center;gap:8px;background:#dc2626;border:none;color:#fff;font-family:'Inter',sans-serif;font-weight:600;font-size:13px;padding:0 24px;cursor:pointer;transition:all .25s;min-width:130px;position:relative;overflow:hidden;flex-shrink:0}
        .s-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.12),transparent);opacity:0;transition:opacity .25s}
        .s-btn:hover{background:#b91c1c}
        .s-btn:hover::after{opacity:1}
        .s-btn-loading{background:#991b1b}
        .s-arrow{font-size:16px;transition:transform .2s}
        .s-btn:hover .s-arrow{transform:translateX(3px)}
        .s-ring{width:14px;height:14px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}

        .err-pill{margin-top:10px;padding:11px 16px;border-radius:10px;display:flex;align-items:center;gap:9px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-size:12.5px}
        .prog-bar{height:3px;background:#f1f5f9;border-radius:2px;margin-top:12px;overflow:hidden;position:relative}
        .prog-fill{height:100%;background:linear-gradient(90deg,#dc2626,#ef4444,#fca5a5,#dc2626);background-size:300%;animation:pFill 2.8s ease-out forwards,pShimmer 2s linear infinite}
        @keyframes pFill{from{width:0%}to{width:88%}}
        @keyframes pShimmer{0%{background-position:0% center}100%{background-position:300% center}}
        .prog-shine{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent);animation:pSweep 1.4s ease infinite}
        @keyframes pSweep{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}

        /* CONTENT */
        .content{display:flex;flex:1;min-height:0;position:relative;z-index:5;gap:14px;padding:0 14px 14px}
        .lcol{flex:0 0 54%;display:flex;flex-direction:column;gap:10px;overflow:hidden}
        .rcol{flex:0 0 46%;display:flex;flex-direction:column;min-height:0}

        /* META */
        .meta-card{border-radius:12px !important;padding:18px 22px;animation:fadeUp .4s ease;flex-shrink:0}
        .meta-topline{display:none}
        .meta-chip{display:inline-flex;align-items:center;gap:5px;font-size:10px;letter-spacing:.5px;color:#16a34a;margin-bottom:10px;font-weight:500;padding:3px 10px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:20px}
        .meta-title{font-size:15px;font-weight:600;line-height:1.5;margin-bottom:8px;color:#0f172a}
        .meta-authors{font-size:11.5px;color:#64748b;margin-bottom:8px;font-style:italic}
        .meta-foot{display:flex;gap:12px;align-items:center;flex-wrap:wrap}
        .meta-date{font-size:11px;color:#94a3b8;font-family:'JetBrains Mono',monospace}
        .meta-id{font-size:11px;color:#dc2626;font-family:'JetBrains Mono',monospace;padding:2px 8px;background:#fef2f2;border-radius:4px;border:1px solid #fecaca}

        /* TABS */
        .tabs{display:flex;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:4px;gap:4px;flex-shrink:0}
        .tab{flex:1;padding:9px 14px;background:transparent;border:none;color:#94a3b8;font-family:'Inter',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;border-radius:7px;display:flex;align-items:center;justify-content:center;gap:7px;position:relative}
        .tab:hover{color:#1e293b;background:#ffffff}
        .tab-on{background:#ffffff !important;color:#dc2626 !important;box-shadow:0 1px 4px rgba(0,0,0,0.08)}
        .tab-pip{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:14px;height:2px;background:#dc2626;border-radius:1px}

        /* SUMMARY */
        .tab-body{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .sum-panel{flex:1;overflow-y:auto;padding:18px;animation:fadeUp .3s ease}
        .sec-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
        .sec-lbl{font-size:11px;color:#b91c1c;font-weight:600;letter-spacing:.5px;white-space:nowrap}
        .sec-line{flex:1;height:1px;background:linear-gradient(90deg,#fecaca,transparent)}
        .abs-text{font-size:13px;line-height:1.8;color:#475569}
        .divfancy{display:flex;align-items:center;gap:10px;margin:18px 0}
        .divfancy span:first-child,.divfancy span:last-child{flex:1;height:1px;background:#fecaca}
        .div-ico{color:#dc2626;font-size:12px}
        .chunk{display:flex;gap:12px;margin-bottom:14px;animation:fadeUp .35s ease}
        .chunk-l{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;padding-top:2px}
        .chunk-n{font-size:10px;color:#dc2626;font-family:'JetBrains Mono',monospace;font-weight:600}
        .chunk-line{flex:1;width:1px;background:linear-gradient(to bottom,#fca5a5,transparent);min-height:16px}
        .chunk-t{font-size:13px;line-height:1.8;color:#334155}

        /* CHAT */
        .chat-panel{flex:1;display:flex;flex-direction:column;min-height:0}
        .chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:12px;min-height:0}
        .chat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;text-align:center;padding:20px}
        .ce-orb{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#fee2e2,#fef2f2);border:1.5px solid #fecaca;animation:ceOrb 3s ease infinite;margin-bottom:4px}
        @keyframes ceOrb{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.07);opacity:1}}
        .ce-title{font-size:13px;color:#64748b;font-weight:500}
        .ce-sub{font-size:11px;color:#94a3b8}
        .hints{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px}
        .hint-btn{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;font-family:'Inter',sans-serif;font-size:11px;font-weight:500;padding:6px 14px;border-radius:20px;cursor:pointer;transition:all .2s}
        .hint-btn:hover{background:#fee2e2;border-color:#fca5a5;color:#991b1b}
        .msg{display:flex;gap:9px;align-items:flex-end;animation:fadeUp .3s ease}
        .msg-u{flex-direction:row-reverse;align-self:flex-end}
        .msg-a{align-self:flex-start}
        .msg-av{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}
        .msg-u .msg-av{background:#dc2626;color:#fff}
        .msg-a .msg-av{background:#f1f5f9;color:#64748b;border:1.5px solid #e2e8f0}
        .msg-bub{padding:10px 15px;border-radius:12px !important;font-size:13px;line-height:1.65;max-width:420px;word-wrap:break-word}
        .bub-u{background:#fef2f2 !important;border-color:#fecaca !important;color:#1e293b !important}
        .thinking{display:flex;align-items:center;gap:5px;padding:12px 18px !important}
        .dot{width:6px;height:6px;border-radius:50%;background:#dc2626;animation:dotP 1.4s ease infinite}
        .dot:nth-child(2){animation-delay:.2s}
        .dot:nth-child(3){animation-delay:.4s}
        @keyframes dotP{0%,80%,100%{transform:scale(.8);opacity:.35}40%{transform:scale(1.1);opacity:1}}
        .chat-in-row{display:flex;gap:9px;padding:10px !important;border-radius:12px !important;margin:7px;margin-top:0;border-color:#fecaca !important;background:#ffffff !important;flex-shrink:0}
        .chat-in{flex:1;background:#f8fafc;border:1.5px solid #e2e8f0;outline:none;color:#1e293b;font-family:'Inter',sans-serif;font-size:13px;padding:9px 14px;border-radius:9px;transition:border-color .2s}
        .chat-in:focus{border-color:#dc2626;box-shadow:0 0 0 3px rgba(220,38,38,0.08)}
        .chat-in::placeholder{color:#cbd5e1}
        .send-btn{width:40px;height:40px;border-radius:9px;flex-shrink:0;background:#dc2626;border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .send-btn:hover{background:#b91c1c;transform:scale(1.04);box-shadow:0 4px 12px rgba(220,38,38,0.3)}
        .send-btn:disabled{opacity:.4}

        /* GRAPH */
        .graph-card{flex:1;border-radius:12px !important;display:flex;flex-direction:column;overflow:hidden}
        .graph-hdr{display:flex;justify-content:space-between;align-items:center;padding:13px 18px;border-bottom:1px solid #fecaca;flex-shrink:0}
        .graph-htitle{display:flex;align-items:center;gap:8px}
        .graph-ico{font-size:14px;color:#dc2626}
        .graph-stats{display:flex;gap:12px}
        .gstat{display:flex;align-items:center;gap:5px;font-size:11px;color:#94a3b8;font-family:'JetBrains Mono',monospace}
        .gsdot{width:7px;height:7px;border-radius:50%}
        .main-dot{background:#dc2626}
        .ref-dot{background:#fca5a5}
        .graph-body{flex:1;position:relative;overflow:hidden;min-height:0;background:#fffbfb}
        .graph-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:#94a3b8;font-size:11.5px;font-family:'JetBrains Mono',monospace}

        .node-tip{position:absolute;bottom:13px;left:13px;right:13px;border-radius:11px !important;padding:12px 15px !important;border-color:#fecaca !important;background:rgba(255,255,255,0.96) !important;animation:fadeUp .2s ease;display:flex;align-items:center;gap:11px;box-shadow:0 4px 16px rgba(185,28,28,0.1) !important}
        .nt-topline{position:absolute;top:0;left:18px;right:18px;height:2px;background:linear-gradient(90deg,transparent,#dc2626,transparent)}
        .nt-body{flex:1;min-width:0}
        .nt-title{font-size:13px;font-weight:600;color:#0f172a;margin-bottom:5px;word-break:break-word}
        .nt-meta{display:flex;align-items:center;gap:7px}
        .nt-type{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:500}
        .nt-main{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
        .nt-ref{background:#f8fafc;border:1px solid #e2e8f0;color:#64748b}
        .nt-id{font-size:10px;color:#94a3b8;font-family:'JetBrains Mono',monospace}
        .nt-close{background:#f8fafc;border:1px solid #e2e8f0;color:#94a3b8;cursor:pointer;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;transition:all .2s}
        .nt-close:hover{background:#fef2f2;border-color:#fecaca;color:#dc2626}

        /* EMPTY STATE */
        .empty{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:5;padding:24px}
        .empty-hero{display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
        .rings{position:relative;width:110px;height:110px;margin-bottom:6px}
        .ring{position:absolute;border-radius:50%;border:1px solid;animation:rPulse 3s ease infinite}
        .r1{inset:0;border-color:rgba(220,38,38,0.3);animation-delay:0s}
        .r2{inset:14px;border-color:rgba(185,28,28,0.22);animation-delay:.5s}
        .r3{inset:28px;border-color:rgba(220,38,38,0.28);animation-delay:1s}
        @keyframes rPulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.05);opacity:1}}
        .ring-core{position:absolute;inset:40px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#dc2626}
        .empty-h{font-size:30px;font-weight:700;color:#1e293b;letter-spacing:-.5px}
        .empty-h span{color:#dc2626}
        .empty-p{font-size:13.5px;color:#64748b;max-width:380px;line-height:1.65}
        .ex-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:4px}
        .ex-lbl{font-size:11px;color:#94a3b8;font-weight:500}
        .ex-btn{display:flex;flex-direction:column;align-items:center;gap:2px;background:#ffffff;border:1.5px solid #fecaca;padding:8px 16px;border-radius:10px;cursor:pointer;transition:all .2s;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
        .ex-btn:hover{background:#fef2f2;border-color:#dc2626;transform:translateY(-2px);box-shadow:0 6px 18px rgba(220,38,38,0.12)}
        .ex-id{font-size:11.5px;color:#dc2626;font-family:'JetBrains Mono',monospace;font-weight:500}
        .ex-nm{font-size:10px;color:#94a3b8}

        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}

        /* ── RESPONSIVE ── */
        @media(max-width:900px){
          .content{flex-direction:column;height:auto;padding:0 10px 18px}
          .lcol{flex:none;width:100%;max-height:none;overflow:visible}
          .rcol{flex:none;width:100%;height:340px}
          .header{padding:12px 16px}
          .search-sec{padding:14px 12px 10px}
          .s-input{font-size:14px;padding:13px 12px}
          .s-btn{min-width:105px;padding:0 16px;font-size:12px}
          .tab-body{max-height:420px}
          .sum-panel{max-height:none}
        }
        @media(max-width:600px){
          .hbadge{display:none}
          .logo-text{font-size:17px}
          .s-prefix{padding:0 10px}
          .s-txt{display:none}
          .search-sec{padding:12px 10px 10px}
          .header{padding:10px 14px}
          .empty-h{font-size:24px}
          .empty-p{font-size:13px}
          .ex-btn{padding:7px 12px}
          .meta-title{font-size:14px}
          .chunk-t,.abs-text{font-size:12.5px}
          .msg-bub{max-width:calc(100vw - 80px)}
        }
        @media(max-width:400px){
          .online-pill{display:none}
          .s-btn{min-width:90px;font-size:11.5px}
        }
      `}</style>
    </div>
  );
}