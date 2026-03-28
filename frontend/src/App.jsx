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

// ─── Particle Canvas ───────────────────────────────────────────
function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);
    const pts = Array.from({ length: 55 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + 0.3, vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28, a: Math.random() * 0.45 + 0.1 }));
    let raf;
    function draw() {
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p) => { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = `rgba(139,92,246,${p.a})`; ctx.fill(); });
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) { const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < 110) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.strokeStyle = `rgba(139,92,246,${0.07 * (1 - d / 110)})`; ctx.lineWidth = 0.5; ctx.stroke(); } }
      raf = requestAnimationFrame(draw);
    }
    draw();
    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.55 }} />;
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
        
        // Main gradient line with vibrant colors
        const gradient = ctx.createLinearGradient(s.x, s.y, t2.x, t2.y);
        gradient.addColorStop(0, "rgba(139, 92, 246, 0.7)");
        gradient.addColorStop(0.5, "rgba(236, 72, 153, 0.85)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0.7)");
        
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
        ctx.stroke();
        
        // Outer glow (softer)
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t2.x, t2.y);
        ctx.strokeStyle = "rgba(139, 92, 246, 0.25)";
        ctx.lineWidth = 5;
        ctx.shadowBlur = 12;
        ctx.stroke();
        
        // ─── 2. ANIMATED FLOWING PARTICLES ALONG LINKS ─────────────────────
        const numParticles = Math.max(2, Math.floor(length / 35));
        for (let i = 0; i < numParticles; i++) {
          // Phase offset based on particle index and time
          const phase = (particleOffsetRef.current + i / numParticles) % 1;
          const px = s.x + dx * phase;
          const py = s.y + dy * phase;
          
          // Size varies with position for trailing effect
          const particleSize = 2.5 * (1 - phase * 0.3);
          const alpha = 0.7 * (1 - Math.abs(phase - 0.5) * 1.2);
          
          ctx.beginPath();
          ctx.arc(px, py, particleSize, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
          ctx.fill();
          
          // Inner core glow
          ctx.beginPath();
          ctx.arc(px, py, particleSize * 0.5, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(236, 72, 153, ${alpha})`;
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
        
        // Outer aura glow
        const auraGradient = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 2.5);
        auraGradient.addColorStop(0, isMain ? "rgba(236, 72, 153, 0.35)" : isHover ? "rgba(139, 92, 246, 0.4)" : "rgba(99, 102, 241, 0.2)");
        auraGradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = auraGradient;
        ctx.fill();
        
        // Node body with radial gradient
        const bodyGradient = ctx.createRadialGradient(
          n.x - radius * 0.25, n.y - radius * 0.25, 2,
          n.x, n.y, radius
        );
        if (isMain) {
          bodyGradient.addColorStop(0, "#f472b6");
          bodyGradient.addColorStop(0.7, "#9333ea");
          bodyGradient.addColorStop(1, "#6b21a5");
        } else if (isHover) {
          bodyGradient.addColorStop(0, "#c084fc");
          bodyGradient.addColorStop(0.7, "#8b5cf6");
          bodyGradient.addColorStop(1, "#4c1d95");
        } else {
          bodyGradient.addColorStop(0, "#a78bfa");
          bodyGradient.addColorStop(0.7, "#6366f1");
          bodyGradient.addColorStop(1, "#312e81");
        }
        
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = bodyGradient;
        ctx.shadowBlur = 14;
        ctx.shadowColor = isMain ? "rgba(236, 72, 153, 0.6)" : "rgba(139, 92, 246, 0.5)";
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
          ctx.font = isMain ? "bold 11px 'JetBrains Mono', monospace" : "10px 'JetBrains Mono', monospace";
          ctx.fillStyle = isMain ? "#fce7f3" : "#e0e7ff";
          ctx.shadowBlur = 4;
          ctx.shadowColor = isMain ? "#ec4899" : "#6366f1";
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
      {/* Orbs */}
      <div className="orb o1" /><div className="orb o2" /><div className="orb o3" /><div className="orb o4" />
      {/* Grid */}
      <div className="grid-bg" />

      {/* ── HEADER ── */}
      <header className="header">
        <div className="hl">
          <svg className="logo-svg" width="40" height="40" viewBox="0 0 40 40">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#ec4899"/></linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.4"/><stop offset="100%" stopColor="#be185d" stopOpacity="0.4"/></linearGradient>
            </defs>
            <polygon points="20,3 36,12 36,28 20,37 4,28 4,12" fill="url(#g2)" stroke="url(#g1)" strokeWidth="1.5"/>
            <text x="20" y="25" textAnchor="middle" fill="white" fontSize="13" fontFamily="monospace" fontWeight="bold">Σ</text>
          </svg>
          <div>
            <div className="logo-text">Ar<span className="gx">X</span>iv <span className="gp">Lens</span></div>
            <div className="logo-sub">AI · RAG · CITATION GRAPH · CHAT</div>
          </div>
        </div>
        <div className="hr">
          <div className="online-pill"><span className="online-dot" />SYSTEM ONLINE</div>
          {["RAG","GRAPH","NLP","LLM"].map(b=><span key={b} className="hbadge">{b}</span>)}
        </div>
      </header>

      {/* ── SEARCH ── */}
      <div className="search-sec">
        <div className="search-glow-wrap">
          <div className="search-box">
            <span className="s-prefix"><span className="s-hex">⬡</span><span className="s-txt">arXiv://</span></span>
            <input className="s-input" placeholder="Enter paper ID — e.g. 2310.06825" value={arxivId} onChange={e=>setArxivId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAnalyze()} />
            <button className={`s-btn${loading?" s-btn-loading":""}`} onClick={handleAnalyze} disabled={loading}>
              {loading ? <><span className="s-ring"/><span>SCANNING</span></> : <><span>ANALYZE</span><span className="s-arrow">→</span></>}
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
              <div className="meta-chip">● PAPER LOADED</div>
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
                  {tab==="summary"?"SUMMARY":"CHAT"}
                  {activeTab===tab&&<span className="tab-pip"/>}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="tab-body">
              {activeTab==="summary"&&(
                <div className="sum-panel">
                  <div className="sec-head"><span className="sec-lbl">ABSTRACT</span><span className="sec-line"/></div>
                  <p className="abs-text">{paper.abstract}</p>
                  <div className="divfancy"><span/><span className="div-ico">◈</span><span/></div>
                  <div className="sec-head"><span className="sec-lbl">AI SYNTHESIS</span><span className="sec-line"/></div>
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
                        <div className="ce-title">Neural interface ready</div>
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
                    <input className="chat-in" placeholder="Query the paper's neural embedding…" value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleChat()}/>
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
                <div className="graph-htitle"><span className="graph-ico">◎</span><span className="sec-lbl">CITATION GRAPH</span></div>
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
            <h1 className="empty-h">ArXiv Intelligence</h1>
            <p className="empty-p">Enter a paper ID to activate the neural analysis engine</p>
            <div className="ex-row">
              <span className="ex-lbl">TRY:</span>
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#05070f;color:#e2e8f0;overflow-x:hidden}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(139,92,246,0.4);border-radius:2px}

        .root{min-height:100vh;display:flex;flex-direction:column;font-family:'Space Grotesk',sans-serif;position:relative}

        /* ORBS */
        .orb{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0}
        .o1{width:520px;height:520px;background:radial-gradient(circle,rgba(124,58,237,0.45),transparent);top:-160px;left:-100px;animation:oa 18s ease-in-out infinite}
        .o2{width:420px;height:420px;background:radial-gradient(circle,rgba(190,24,93,0.4),transparent);top:25%;right:-120px;animation:ob 22s ease-in-out infinite}
        .o3{width:360px;height:360px;background:radial-gradient(circle,rgba(29,78,216,0.35),transparent);bottom:8%;left:18%;animation:oc 16s ease-in-out infinite}
        .o4{width:280px;height:280px;background:radial-gradient(circle,rgba(8,145,178,0.3),transparent);bottom:-60px;right:8%;animation:oa 20s ease-in-out infinite reverse}
        @keyframes oa{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-28px) scale(1.06)}66%{transform:translate(-22px,38px) scale(0.94)}}
        @keyframes ob{0%,100%{transform:translate(0,0)}33%{transform:translate(-28px,22px)}66%{transform:translate(22px,-38px)}}
        @keyframes oc{0%,100%{transform:scale(0.9)}50%{transform:translate(-38px,-18px) scale(1.1)}}

        .grid-bg{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.025;background-image:linear-gradient(rgba(139,92,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,1) 1px,transparent 1px);background-size:60px 60px}

        /* GLASS */
        .gc{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);box-shadow:0 8px 32px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.07);position:relative;overflow:hidden}
        .gc::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.055) 0%,transparent 55%);pointer-events:none}

        /* HEADER */
        .header{position:relative;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:15px 26px;border-bottom:1px solid rgba(139,92,246,0.18);background:rgba(5,7,15,0.75);backdrop-filter:blur(20px);gap:14px;flex-wrap:wrap}
        .hl{display:flex;align-items:center;gap:14px}
        .logo-svg{filter:drop-shadow(0 0 10px rgba(139,92,246,0.55));animation:logoHue 10s ease-in-out infinite alternate}
        @keyframes logoHue{0%{filter:drop-shadow(0 0 10px rgba(139,92,246,0.55))}100%{filter:drop-shadow(0 0 14px rgba(236,72,153,0.6))}}
        .logo-text{font-size:21px;font-weight:700;letter-spacing:.5px}
        .gx{background:linear-gradient(135deg,#f472b6,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .gp{background:linear-gradient(135deg,#a78bfa,#7c3aed);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
        .logo-sub{font-size:9px;color:rgba(226,232,240,0.2);letter-spacing:3px;font-family:'JetBrains Mono',monospace;margin-top:2px}
        .hr{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
        .online-pill{display:flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.22);font-size:9px;color:#34d399;letter-spacing:2px;font-family:'JetBrains Mono',monospace}
        .online-dot{width:6px;height:6px;background:#34d399;border-radius:50%;animation:onPulse 2s ease infinite;box-shadow:0 0 6px #34d399}
        @keyframes onPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.5;transform:scale(0.8)}}
        .hbadge{font-size:9px;padding:3px 8px;border-radius:4px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.22);color:rgba(167,139,250,0.75);letter-spacing:2px;font-family:'JetBrains Mono',monospace}

        /* SEARCH */
        .search-sec{padding:22px 26px 14px;position:relative;z-index:5}
        .search-glow-wrap{position:relative}
        .search-glow-wrap::before{content:'';position:absolute;inset:-3px;border-radius:15px;background:linear-gradient(135deg,rgba(139,92,246,0.25),rgba(236,72,153,0.25));filter:blur(10px);opacity:0;transition:opacity .3s;pointer-events:none}
        .search-glow-wrap:focus-within::before{opacity:1}
        .search-box{display:flex;align-items:stretch;background:rgba(15,18,35,0.82);border:1px solid rgba(139,92,246,0.22);border-radius:13px;overflow:hidden;backdrop-filter:blur(18px);transition:border-color .3s}
        .search-box:focus-within{border-color:rgba(139,92,246,0.55)}
        .s-prefix{display:flex;align-items:center;gap:7px;padding:0 16px;border-right:1px solid rgba(255,255,255,0.07);white-space:nowrap}
        .s-hex{font-size:15px;color:#a78bfa;animation:hexPulse 3s ease infinite}
        @keyframes hexPulse{0%,100%{color:#a78bfa}50%{color:#ec4899}}
        .s-txt{font-size:11px;color:rgba(167,139,250,0.55);font-family:'JetBrains Mono',monospace}
        .s-input{flex:1;background:transparent;border:none;outline:none;color:#e2e8f0;font-family:'JetBrains Mono',monospace;font-size:14px;padding:15px 16px;letter-spacing:.5px;min-width:0}
        .s-input::placeholder{color:rgba(226,232,240,0.18)}
        .s-btn{display:flex;align-items:center;justify-content:center;gap:9px;background:linear-gradient(135deg,#7c3aed,#be185d);border:none;color:#fff;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:12px;padding:0 26px;cursor:pointer;letter-spacing:2px;transition:all .3s;min-width:136px;position:relative;overflow:hidden}
        .s-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.14),transparent);opacity:0;transition:opacity .3s}
        .s-btn:hover::after{opacity:1}
        .s-btn:hover{box-shadow:0 0 22px rgba(139,92,246,0.5)}
        .s-btn-loading{background:linear-gradient(135deg,#4c1d95,#831843)}
        .s-arrow{font-size:17px;transition:transform .2s}
        .s-btn:hover .s-arrow{transform:translateX(3px)}
        .s-ring{width:15px;height:15px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
        @keyframes spin{to{transform:rotate(360deg)}}

        .err-pill{margin-top:11px;padding:11px 16px;border-radius:10px;display:flex;align-items:center;gap:9px;background:rgba(220,38,38,0.1);border:1px solid rgba(220,38,38,0.28);color:#fca5a5;font-size:12px;font-family:'JetBrains Mono',monospace}
        .prog-bar{height:3px;background:rgba(255,255,255,0.05);border-radius:2px;margin-top:13px;overflow:hidden;position:relative}
        .prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#ec4899,#06b6d4,#7c3aed);background-size:300%;animation:pFill 2.8s ease-out forwards,pShimmer 2s linear infinite}
        @keyframes pFill{from{width:0%}to{width:88%}}
        @keyframes pShimmer{0%{background-position:0% center}100%{background-position:300% center}}
        .prog-shine{position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent);animation:pSweep 1.4s ease infinite}
        @keyframes pSweep{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}

        /* CONTENT */
        .content{display:flex;flex:1;min-height:0;position:relative;z-index:5;gap:14px;padding:0 14px 14px}
        .lcol{flex:0 0 54%;display:flex;flex-direction:column;gap:10px;overflow:hidden}
        .rcol{flex:0 0 46%;display:flex;flex-direction:column;min-height:0}

        /* META */
        .meta-card{border-radius:13px !important;padding:19px 22px;animation:fadeUp .5s ease;flex-shrink:0}
        .meta-topline{position:absolute;top:0;left:22px;right:22px;height:2px;background:linear-gradient(90deg,transparent,#a78bfa,#ec4899,transparent)}
        .meta-chip{display:inline-block;font-size:9px;letter-spacing:3px;color:#34d399;margin-bottom:11px;font-family:'JetBrains Mono',monospace;padding:2px 9px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.2);border-radius:4px}
        .meta-title{font-size:14.5px;font-weight:600;line-height:1.55;margin-bottom:9px;color:#f1f5f9}
        .meta-authors{font-size:11px;color:rgba(226,232,240,0.42);margin-bottom:9px;font-family:'JetBrains Mono',monospace}
        .meta-foot{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
        .meta-date{font-size:10px;color:rgba(226,232,240,0.2);font-family:'JetBrains Mono',monospace}
        .meta-id{font-size:10px;color:#a78bfa;font-family:'JetBrains Mono',monospace;padding:2px 7px;background:rgba(139,92,246,0.1);border-radius:4px;border:1px solid rgba(139,92,246,0.2)}

        /* TABS */
        .tabs{display:flex;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:4px;gap:4px;flex-shrink:0}
        .tab{flex:1;padding:9px 14px;background:transparent;border:none;color:rgba(226,232,240,0.4);font-family:'Space Grotesk',sans-serif;font-size:11px;letter-spacing:2px;font-weight:600;cursor:pointer;transition:all .2s;border-radius:7px;display:flex;align-items:center;justify-content:center;gap:7px;position:relative}
        .tab:hover{color:#e2e8f0;background:rgba(255,255,255,0.04)}
        .tab-on{background:rgba(139,92,246,0.18) !important;color:#a78bfa !important;box-shadow:0 0 16px rgba(139,92,246,0.18),inset 0 1px 0 rgba(255,255,255,0.07)}
        .tab-pip{position:absolute;bottom:3px;left:50%;transform:translateX(-50%);width:14px;height:2px;background:linear-gradient(90deg,#8b5cf6,#ec4899);border-radius:1px}

        /* SUMMARY */
        .tab-body{flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0}
        .sum-panel{flex:1;overflow-y:auto;padding:18px;animation:fadeUp .3s ease}
        .sec-head{display:flex;align-items:center;gap:11px;margin-bottom:13px}
        .sec-lbl{font-size:9px;color:#a78bfa;letter-spacing:3px;font-family:'JetBrains Mono',monospace;white-space:nowrap}
        .sec-line{flex:1;height:1px;background:linear-gradient(90deg,rgba(139,92,246,0.28),transparent)}
        .abs-text{font-size:12.5px;line-height:1.85;color:rgba(226,232,240,0.58)}
        .divfancy{display:flex;align-items:center;gap:11px;margin:20px 0}
        .divfancy span:first-child,.divfancy span:last-child{flex:1;height:1px;background:rgba(255,255,255,0.06)}
        .div-ico{color:#a78bfa;font-size:13px}
        .chunk{display:flex;gap:13px;margin-bottom:15px;animation:fadeUp .4s ease}
        .chunk-l{display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;padding-top:2px}
        .chunk-n{font-size:10px;color:#ec4899;font-family:'JetBrains Mono',monospace;font-weight:700}
        .chunk-line{flex:1;width:1px;background:linear-gradient(to bottom,rgba(236,72,153,0.38),transparent);min-height:18px}
        .chunk-t{font-size:12.5px;line-height:1.85;color:#e2e8f0}

        /* CHAT */
        .chat-panel{flex:1;display:flex;flex-direction:column;min-height:0}
        .chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:13px;min-height:0}
        .chat-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:9px;text-align:center}
        .ce-orb{width:55px;height:55px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.28),transparent);border:1px solid rgba(139,92,246,0.28);animation:ceOrb 3s ease infinite;box-shadow:0 0 28px rgba(139,92,246,0.12);margin-bottom:4px}
        @keyframes ceOrb{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.1);opacity:1}}
        .ce-title{font-size:12.5px;color:rgba(226,232,240,0.5);font-weight:500}
        .ce-sub{font-size:10px;color:rgba(226,232,240,0.2);font-family:'JetBrains Mono',monospace}
        .hints{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:8px}
        .hint-btn{background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.18);color:rgba(167,139,250,0.65);font-family:'Space Grotesk',sans-serif;font-size:10.5px;padding:6px 13px;border-radius:20px;cursor:pointer;transition:all .2s}
        .hint-btn:hover{background:rgba(139,92,246,0.17);border-color:rgba(139,92,246,0.38);color:#a78bfa}
        .msg{display:flex;gap:9px;align-items:flex-end;animation:fadeUp .3s ease}
        .msg-u{flex-direction:row-reverse;align-self:flex-end}
        .msg-a{align-self:flex-start}
        .msg-av{width:29px;height:29px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;letter-spacing:.5px;flex-shrink:0}
        .msg-u .msg-av{background:linear-gradient(135deg,#7c3aed,#be185d);color:#fff}
        .msg-a .msg-av{background:linear-gradient(135deg,#1e3a5f,#1a1a3e);color:#a78bfa;border:1px solid rgba(139,92,246,0.28)}
        .msg-bub{padding:10px 15px;border-radius:13px !important;font-size:12.5px;line-height:1.7;max-width:410px;word-wrap:break-word}
        .bub-u{background:rgba(124,58,237,0.18) !important;border-color:rgba(139,92,246,0.28) !important}
        .thinking{display:flex;align-items:center;gap:5px;padding:13px 18px !important}
        .dot{width:6px;height:6px;border-radius:50%;background:#a78bfa;animation:dotP 1.4s ease infinite}
        .dot:nth-child(2){animation-delay:.2s}
        .dot:nth-child(3){animation-delay:.4s}
        @keyframes dotP{0%,80%,100%{transform:scale(.8);opacity:.4}40%{transform:scale(1.1);opacity:1}}
        .chat-in-row{display:flex;gap:9px;padding:11px !important;border-radius:12px !important;margin:7px;margin-top:0;border-color:rgba(139,92,246,0.18) !important;background:rgba(10,12,25,0.82) !important;flex-shrink:0}
        .chat-in{flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);outline:none;color:#e2e8f0;font-family:'Space Grotesk',sans-serif;font-size:12.5px;padding:9px 13px;border-radius:9px;transition:border-color .2s}
        .chat-in:focus{border-color:rgba(139,92,246,0.38)}
        .chat-in::placeholder{color:rgba(226,232,240,0.18)}
        .send-btn{width:40px;height:40px;border-radius:10px;flex-shrink:0;background:linear-gradient(135deg,#7c3aed,#be185d);border:none;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .send-btn:hover{box-shadow:0 0 16px rgba(139,92,246,0.5);transform:scale(1.06)}
        .send-btn:disabled{opacity:.38}

        /* GRAPH */
        .graph-card{flex:1;border-radius:13px !important;display:flex;flex-direction:column;overflow:hidden}
        .graph-hdr{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0}
        .graph-htitle{display:flex;align-items:center;gap:9px}
        .graph-ico{font-size:15px;color:#a78bfa;animation:gIco 6s ease-in-out infinite alternate}
        @keyframes gIco{0%{color:#a78bfa}100%{color:#ec4899}}
        .graph-stats{display:flex;gap:13px}
        .gstat{display:flex;align-items:center;gap:5px;font-size:10px;color:rgba(226,232,240,0.2);font-family:'JetBrains Mono',monospace}
        .gsdot{width:7px;height:7px;border-radius:50%}
        .main-dot{background:linear-gradient(135deg,#ec4899,#9333ea);box-shadow:0 0 6px rgba(236,72,153,0.5)}
        .ref-dot{background:linear-gradient(135deg,#818cf8,#3730a3);box-shadow:0 0 6px rgba(129,140,248,0.38)}
        .graph-body{flex:1;position:relative;overflow:hidden;min-height:0}
        .graph-empty{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;color:rgba(226,232,240,0.2);font-size:11px;letter-spacing:2px;font-family:'JetBrains Mono',monospace}

        .node-tip{position:absolute;bottom:13px;left:13px;right:13px;border-radius:12px !important;padding:13px 15px !important;border-color:rgba(139,92,246,0.35) !important;background:rgba(10,12,25,0.92) !important;animation:fadeUp .2s ease;display:flex;align-items:center;gap:11px}
        .nt-topline{position:absolute;top:0;left:18px;right:18px;height:1px;background:linear-gradient(90deg,transparent,#a78bfa,transparent)}
        .nt-body{flex:1;min-width:0}
        .nt-title{font-size:12.5px;font-weight:600;color:#e2e8f0;margin-bottom:5px;word-break:break-word}
        .nt-meta{display:flex;align-items:center;gap:7px}
        .nt-type{font-size:9px;padding:2px 8px;border-radius:4px;letter-spacing:2px;font-family:'JetBrains Mono',monospace}
        .nt-main{background:rgba(236,72,153,0.14);border:1px solid rgba(236,72,153,0.28);color:#f472b6}
        .nt-ref{background:rgba(99,102,241,0.14);border:1px solid rgba(99,102,241,0.28);color:#818cf8}
        .nt-id{font-size:9px;color:rgba(226,232,240,0.2);font-family:'JetBrains Mono',monospace}
        .nt-close{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);color:rgba(226,232,240,0.45);cursor:pointer;width:27px;height:27px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;flex-shrink:0;transition:all .2s}
        .nt-close:hover{background:rgba(239,68,68,0.14);border-color:rgba(239,68,68,0.28);color:#fca5a5}

        /* EMPTY */
        .empty{flex:1;display:flex;align-items:center;justify-content:center;position:relative;z-index:5;padding:20px}
        .empty-hero{display:flex;flex-direction:column;align-items:center;gap:18px;text-align:center}
        .rings{position:relative;width:110px;height:110px;margin-bottom:8px}
        .ring{position:absolute;border-radius:50%;border:1px solid;animation:rPulse 3s ease infinite}
        .r1{inset:0;border-color:rgba(139,92,246,0.38);animation-delay:0s}
        .r2{inset:14px;border-color:rgba(236,72,153,0.28);animation-delay:.5s}
        .r3{inset:28px;border-color:rgba(99,102,241,0.38);animation-delay:1s}
        @keyframes rPulse{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.06);opacity:1}}
        .ring-core{position:absolute;inset:40px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:cGlow 2s ease infinite}
        @keyframes cGlow{0%,100%{filter:brightness(1)}50%{filter:brightness(1.6)}}
        .empty-h{font-size:30px;font-weight:700;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:-.5px}
        .empty-p{font-size:13px;color:rgba(226,232,240,0.45);max-width:340px;line-height:1.6}
        .ex-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:5px}
        .ex-lbl{font-size:9px;color:rgba(226,232,240,0.2);letter-spacing:2px;font-family:'JetBrains Mono',monospace}
        .ex-btn{display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.2);padding:8px 15px;border-radius:10px;cursor:pointer;transition:all .2s}
        .ex-btn:hover{background:rgba(139,92,246,0.17);border-color:rgba(139,92,246,0.38);transform:translateY(-2px);box-shadow:0 8px 20px rgba(139,92,246,0.2)}
        .ex-id{font-size:11px;color:#a78bfa;font-family:'JetBrains Mono',monospace}
        .ex-nm{font-size:9px;color:rgba(226,232,240,0.25)}

        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}

        /* RESPONSIVE */
        @media(max-width:900px){
          .content{flex-direction:column;height:auto;padding:0 10px 18px}
          .lcol{flex:none;width:100%;max-height:52vh}
          .rcol{flex:none;width:100%;height:310px}
          .header{padding:13px 16px}
          .search-sec{padding:14px 10px 10px}
          .s-input{font-size:13px;padding:13px 12px}
          .s-btn{min-width:100px;padding:0 16px;font-size:11px}
        }
        @media(max-width:480px){
          .hbadge{display:none}
          .logo-text{font-size:17px}
          .s-prefix{padding:0 10px}
          .s-txt{display:none}
        }
      `}</style>
    </div>
  );
}