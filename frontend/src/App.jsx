import { useState, useEffect, useRef, useCallback } from "react";

// ─── API ───────────────────────────────────────────────────────
const API = "http://localhost:8000";

async function analyzePaper(arxivId) {
  const res = await fetch(`${API}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arxiv_id: arxivId }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Analysis failed");
  return res.json();
}

async function chatWithPaper(arxivId, question) {
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arxiv_id: arxivId, question }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Chat failed");
  return res.json();
}

// ─── Force Graph (D3-style, pure canvas) ───────────────────────
function CitationGraph({ graph, onNodeClick }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const hoveredRef = useRef(null);

  useEffect(() => {
    if (!graph?.nodes?.length) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    // Init nodes with random positions
    nodesRef.current = graph.nodes.map((n, i) => ({
      ...n,
      x: W / 2 + (Math.random() - 0.5) * 300,
      y: H / 2 + (Math.random() - 0.5) * 300,
      vx: 0,
      vy: 0,
    }));
    linksRef.current = graph.links || [];

    const nodeMap = {};
    nodesRef.current.forEach((n) => (nodeMap[n.id] = n));

    function tick() {
      const nodes = nodesRef.current;
      const links = linksRef.current;

      // Repulsion
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 1800 / (dist * dist);
          nodes[i].vx -= (dx / dist) * force;
          nodes[i].vy -= (dy / dist) * force;
          nodes[j].vx += (dx / dist) * force;
          nodes[j].vy += (dy / dist) * force;
        }
      }

      // Attraction (links)
      links.forEach((l) => {
        const s = nodeMap[l.source];
        const t = nodeMap[l.target];
        if (!s || !t) return;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.03;
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      });

      // Center gravity
      nodes.forEach((n) => {
        n.vx += (W / 2 - n.x) * 0.005;
        n.vy += (H / 2 - n.y) * 0.005;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      });

      // Draw
      ctx.clearRect(0, 0, W, H);

      // Links
      links.forEach((l) => {
        const s = nodeMap[l.source];
        const t = nodeMap[l.target];
        if (!s || !t) return;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);
        ctx.strokeStyle = "rgba(180,140,60,0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // Nodes
      nodes.forEach((n) => {
        const isMain = n.type === "main";
        const isHovered = hoveredRef.current === n.id;
        const r = isMain ? 14 : 8;

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isMain
          ? "#D4A853"
          : isHovered
          ? "#8BAFC2"
          : "#2A4A5E";
        ctx.fill();
        ctx.strokeStyle = isMain ? "#F5C842" : isHovered ? "#A8C8DC" : "#3D6B85";
        ctx.lineWidth = isMain ? 2.5 : 1.5;
        ctx.stroke();

        if (isMain || isHovered) {
          ctx.font = isMain ? "bold 11px 'Courier New'" : "10px 'Courier New'";
          ctx.fillStyle = isMain ? "#F5C842" : "#8BAFC2";
          const label = n.title ? n.title.slice(0, 28) + (n.title.length > 28 ? "…" : "") : n.id.slice(0, 12);
          ctx.fillText(label, n.x + r + 4, n.y + 4);
        }
      });

      animRef.current = requestAnimationFrame(tick);
    }

    animRef.current = requestAnimationFrame(tick);

    // Mouse interaction
    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let found = null;
      nodesRef.current.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < 12) found = n.id;
      });
      hoveredRef.current = found;
      canvas.style.cursor = found ? "pointer" : "default";
    }

    function handleClick(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      nodesRef.current.forEach((n) => {
        const dx = n.x - mx;
        const dy = n.y - my;
        if (Math.sqrt(dx * dx + dy * dy) < 12 && onNodeClick) {
          onNodeClick(n);
        }
      });
    }

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [graph]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "200%", height: "100%", display: "block" }}
    />
  );
}

// ─── Main App ──────────────────────────────────────────────────
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleAnalyze() {
    const id = arxivId.trim();
    if (!id) return;
    setLoading(true);
    setError("");
    setPaper(null);
    setMessages([]);
    setSelectedNode(null);
    try {
      const data = await analyzePaper(id);
      setPaper(data);
      setActiveTab("summary");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleChat() {
    if (!question.trim() || !paper) return;
    const q = question.trim();
    setQuestion("");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const data = await chatWithPaper(paper.arxiv_id || arxivId, q);
      setMessages((m) => [...m, { role: "ai", text: data.answer }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "ai", text: `Error: ${e.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      {/* Noise overlay */}
      <div style={styles.noise} />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.logo}>⬡</span>
          <div>
            <div style={styles.logoTitle}>ARXIV LENS</div>
            <div style={styles.logoSub}>AI Research Intelligence System</div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <span style={styles.badge}>RAG</span>
          <span style={styles.badge}>GRAPH</span>
          <span style={styles.badge}>NLP</span>
        </div>
      </header>

      {/* Search bar */}
      <div style={styles.searchSection}>
        <div style={styles.searchBox}>
          <span style={styles.searchPrefix}>arXiv://</span>
          <input
            style={styles.searchInput}
            placeholder="2310.06825"
            value={arxivId}
            onChange={(e) => setArxivId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
          />
          <button
            style={{ ...styles.analyzeBtn, opacity: loading ? 0.6 : 1 }}
            onClick={handleAnalyze}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.spinner}>◌</span>
            ) : (
              "ANALYZE →"
            )}
          </button>
        </div>
        {error && <div style={styles.error}>⚠ {error}</div>}
        {loading && (
          <div style={styles.loadingBar}>
            <div style={styles.loadingFill} />
          </div>
        )}
      </div>

      {/* Content */}
      {paper && (
        <div style={styles.content}>
          {/* Left: Paper meta + tabs */}
          <div style={styles.leftCol}>
            {/* Paper meta */}
            <div style={styles.metaCard}>
              <div style={styles.metaTitle}>{paper.title}</div>
              <div style={styles.metaAuthors}>
                {paper.authors?.slice(0, 4).join(", ")}
                {paper.authors?.length > 4 && " et al."}
              </div>
              <div style={styles.metaDate}>{paper.published?.slice(0, 10)}</div>
            </div>

            {/* Tabs */}
            <div style={styles.tabs}>
              {["summary", "chat"].map((tab) => (
                <button
                  key={tab}
                  style={{
                    ...styles.tab,
                    ...(activeTab === tab ? styles.tabActive : {}),
                  }}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === "summary" ? "📄 SUMMARY" : "💬 CHAT"}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={styles.tabContent}>
              {activeTab === "summary" && (
                <div style={styles.summaryPanel}>
                  <div style={styles.sectionLabel}>ABSTRACT</div>
                  <p style={styles.abstractText}>{paper.abstract}</p>
                  <div style={styles.divider} />
                  <div style={styles.sectionLabel}>AI SUMMARY</div>
                  {paper.summary?.sections?.map((s, i) => (
                    <div key={i} style={styles.summaryChunk}>
                      <span style={styles.chunkNum}>[{String(i + 1).padStart(2, "0")}]</span>
                      <p style={styles.chunkText}>{s}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "chat" && (
                <div style={styles.chatPanel}>
                  <div style={styles.chatMessages}>
                    {messages.length === 0 && (
                      <div style={styles.chatEmpty}>
                        <div style={styles.chatEmptyIcon}>⬡</div>
                        <div>Ask anything about this paper</div>
                        <div style={styles.chatHints}>
                          {[
                            "What dataset was used?",
                            "What is the main contribution?",
                            "What are the limitations?",
                          ].map((h) => (
                            <button
                              key={h}
                              style={styles.hintBtn}
                              onClick={() => setQuestion(h)}
                            >
                              {h}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <div
                        key={i}
                        style={{
                          ...styles.message,
                          ...(m.role === "user" ? styles.msgUser : styles.msgAI),
                        }}
                      >
                        <span style={styles.msgRole}>
                          {m.role === "user" ? "YOU" : "AI"}
                        </span>
                        <span style={styles.msgText}>{m.text}</span>
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ ...styles.message, ...styles.msgAI }}>
                        <span style={styles.msgRole}>AI</span>
                        <span style={styles.thinking}>thinking…</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={styles.chatInputRow}>
                    <input
                      style={styles.chatInput}
                      placeholder="Ask about this paper…"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    />
                    <button
                      style={styles.sendBtn}
                      onClick={handleChat}
                      disabled={chatLoading}
                    >
                      ↑
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Citation graph */}
          <div style={styles.rightCol}>
            <div style={styles.graphHeader}>
              <span style={styles.sectionLabel}>CITATION GRAPH</span>
              <span style={styles.graphCount}>
                {paper.graph?.nodes?.length || 0} nodes
              </span>
            </div>
            <div style={styles.graphContainer}>
              <CitationGraph
                graph={paper.graph}
                onNodeClick={(n) => setSelectedNode(n)}
              />
            </div>
            {selectedNode && (
              <div style={styles.nodeTooltip}>
                <div style={styles.nodeTooltipTitle}>{selectedNode.title || selectedNode.id}</div>
                <div style={styles.nodeTooltipType}>{selectedNode.type}</div>
                <button
                  style={styles.nodeTooltipClose}
                  onClick={() => setSelectedNode(null)}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!paper && !loading && (
        <div style={styles.emptyState}>
          <div style={styles.emptyGrid}>
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} style={styles.emptyGridCell} />
            ))}
          </div>
          <div style={styles.emptyText}>
            <div style={styles.emptyIcon}>⬡</div>
            <div style={styles.emptyTitle}>Enter an ArXiv ID to begin</div>
            <div style={styles.emptySub}>
              Try <span style={styles.exampleId} onClick={() => setArxivId("2310.06825")}>2310.06825</span> · <span style={styles.exampleId} onClick={() => setArxivId("1706.03762")}>1706.03762</span> · <span style={styles.exampleId} onClick={() => setArxivId("2005.11401")}>2005.11401</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Share+Tech+Mono&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080E14; }

        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes loadfill { from { width: 0% } to { width: 85% } }
        @keyframes pulse { 0%,100% { opacity:0.4 } 50% { opacity:1 } }
        @keyframes fadeup { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }

        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0D1620; }
        ::-webkit-scrollbar-thumb { background: #2A4A5E; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: "100vh",
    background: "#080E14",
    color: "#C8D8E4",
    fontFamily: "'Share Tech Mono', monospace",
    position: "relative",
    overflow: "hidden",
  },
  noise: {
    position: "fixed",
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
    pointerEvents: "none",
    zIndex: 0,
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 32px",
    borderBottom: "1px solid #1A2E3E",
    background: "rgba(8,14,20,0.9)",
    backdropFilter: "blur(12px)",
    position: "relative",
    zIndex: 10,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  logo: {
    fontSize: 28,
    color: "#D4A853",
    lineHeight: 1,
  },
  logoTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 20,
    color: "#E8D5A0",
    fontWeight: 700,
    letterSpacing: 3,
  },
  logoSub: {
    fontSize: 10,
    color: "#4A7A96",
    letterSpacing: 2,
    marginTop: 2,
  },
  headerRight: {
    display: "flex",
    gap: 8,
  },
  badge: {
    fontSize: 10,
    padding: "3px 8px",
    border: "1px solid #2A4A5E",
    color: "#4A7A96",
    letterSpacing: 2,
    borderRadius: 2,
  },
  searchSection: {
    padding: "28px 32px 20px",
    position: "relative",
    zIndex: 5,
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    background: "#0D1620",
    border: "1px solid #2A4A5E",
    borderRadius: 4,
    overflow: "hidden",
    maxWidth: 720,
  },
  searchPrefix: {
    padding: "0 14px",
    color: "#D4A853",
    fontSize: 13,
    borderRight: "1px solid #1A2E3E",
    whiteSpace: "nowrap",
  },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#C8D8E4",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    padding: "14px 16px",
    letterSpacing: 1,
  },
  analyzeBtn: {
    background: "#D4A853",
    border: "none",
    color: "#080E14",
    fontFamily: "'Share Tech Mono', monospace",
    fontWeight: 700,
    fontSize: 12,
    padding: "14px 22px",
    cursor: "pointer",
    letterSpacing: 2,
    transition: "background 0.2s",
  },
  spinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },
  error: {
    color: "#C0504A",
    fontSize: 12,
    marginTop: 10,
    letterSpacing: 1,
  },
  loadingBar: {
    height: 2,
    background: "#1A2E3E",
    marginTop: 12,
    maxWidth: 720,
    borderRadius: 1,
    overflow: "hidden",
  },
  loadingFill: {
    height: "100%",
    background: "linear-gradient(90deg, #D4A853, #F5C842)",
    animation: "loadfill 3s ease-out forwards",
  },
  content: {
    display: "flex",
    gap: 0,
    height: "calc(100vh - 180px)",
    position: "relative",
    zIndex: 5,
  },
  leftCol: {
    width: "55%",
    display: "flex",
    flexDirection: "column",
    borderRight: "1px solid #1A2E3E",
    overflow: "hidden",
  },
  metaCard: {
    padding: "18px 28px",
    borderBottom: "1px solid #1A2E3E",
    background: "#0A1520",
    animation: "fadeup 0.4s ease",
  },
  metaTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 15,
    color: "#E8D5A0",
    lineHeight: 1.5,
    marginBottom: 8,
  },
  metaAuthors: {
    fontSize: 11,
    color: "#4A7A96",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  metaDate: {
    fontSize: 10,
    color: "#2A4A5E",
    letterSpacing: 1,
  },
  tabs: {
    display: "flex",
    borderBottom: "1px solid #1A2E3E",
  },
  tab: {
    flex: 1,
    padding: "12px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#4A7A96",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    letterSpacing: 2,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  tabActive: {
    color: "#D4A853",
    borderBottomColor: "#D4A853",
    background: "rgba(212,168,83,0.05)",
  },
  tabContent: {
    flex: 1,
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  summaryPanel: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 28px",
    animation: "fadeup 0.3s ease",
  },
  sectionLabel: {
    fontSize: 10,
    color: "#D4A853",
    letterSpacing: 3,
    marginBottom: 10,
  },
  abstractText: {
    fontSize: 12,
    lineHeight: 1.8,
    color: "#8BAFC2",
  },
  divider: {
    height: 1,
    background: "#1A2E3E",
    margin: "20px 0",
  },
  summaryChunk: {
    display: "flex",
    gap: 12,
    marginBottom: 14,
    animation: "fadeup 0.4s ease",
  },
  chunkNum: {
    color: "#D4A853",
    fontSize: 11,
    whiteSpace: "nowrap",
    marginTop: 2,
  },
  chunkText: {
    fontSize: 12,
    lineHeight: 1.8,
    color: "#C8D8E4",
  },
  chatPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  chatMessages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  chatEmpty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 14,
    color: "#2A4A5E",
    fontSize: 12,
    letterSpacing: 1,
  },
  chatEmptyIcon: {
    fontSize: 36,
    color: "#1A2E3E",
  },
  chatHints: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    alignItems: "center",
    marginTop: 8,
  },
  hintBtn: {
    background: "transparent",
    border: "1px solid #1A2E3E",
    color: "#4A7A96",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 11,
    padding: "6px 14px",
    cursor: "pointer",
    borderRadius: 2,
    letterSpacing: 0.5,
    transition: "border-color 0.2s, color 0.2s",
  },
  message: {
    display: "flex",
    gap: 12,
    fontSize: 12,
    lineHeight: 1.7,
    animation: "fadeup 0.3s ease",
  },
  msgUser: {
    alignSelf: "flex-end",
    flexDirection: "row-reverse",
  },
  msgAI: {
    alignSelf: "flex-start",
  },
  msgRole: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#D4A853",
    marginTop: 3,
    whiteSpace: "nowrap",
  },
  msgText: {
    background: "#0D1620",
    border: "1px solid #1A2E3E",
    padding: "8px 14px",
    borderRadius: 3,
    color: "#C8D8E4",
    maxWidth: 480,
  },
  thinking: {
    color: "#4A7A96",
    animation: "pulse 1.4s ease infinite",
  },
  chatInputRow: {
    display: "flex",
    borderTop: "1px solid #1A2E3E",
    padding: "12px 20px",
    gap: 10,
    background: "#0A1520",
  },
  chatInput: {
    flex: 1,
    background: "#0D1620",
    border: "1px solid #1A2E3E",
    outline: "none",
    color: "#C8D8E4",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 12,
    padding: "10px 14px",
    borderRadius: 3,
  },
  sendBtn: {
    background: "#D4A853",
    border: "none",
    color: "#080E14",
    fontWeight: 700,
    fontSize: 16,
    width: 40,
    height: 40,
    borderRadius: 3,
    cursor: "pointer",
  },
  rightCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    background: "#080E14",
  },
  graphHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid #1A2E3E",
  },
  graphCount: {
    fontSize: 10,
    color: "#2A4A5E",
    letterSpacing: 1,
  },
  graphContainer: {
    flex: 1,
    position: "relative",
  },
  nodeTooltip: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    background: "#0D1620",
    border: "1px solid #D4A853",
    padding: "12px 16px",
    borderRadius: 3,
    animation: "fadeup 0.2s ease",
  },
  nodeTooltipTitle: {
    fontFamily: "'Playfair Display', serif",
    fontSize: 13,
    color: "#E8D5A0",
    marginBottom: 4,
    paddingRight: 20,
  },
  nodeTooltipType: {
    fontSize: 10,
    color: "#4A7A96",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  nodeTooltipClose: {
    position: "absolute",
    top: 10,
    right: 12,
    background: "transparent",
    border: "none",
    color: "#4A7A96",
    cursor: "pointer",
    fontSize: 12,
  },
  emptyState: {
    position: "relative",
    zIndex: 5,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "calc(100vh - 200px)",
    flexDirection: "column",
    gap: 24,
  },
  emptyGrid: {
    position: "absolute",
    inset: 0,
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gridTemplateRows: "repeat(4, 1fr)",
    opacity: 0.04,
    pointerEvents: "none",
  },
  emptyGridCell: {
    border: "1px solid #4A7A96",
  },
  emptyText: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  emptyIcon: {
    fontSize: 48,
    color: "#1A2E3E",
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 13,
    color: "#2A4A5E",
    letterSpacing: 2,
  },
  emptySub: {
    fontSize: 11,
    color: "#1A2E3E",
    letterSpacing: 1,
  },
  exampleId: {
    color: "#D4A853",
    cursor: "pointer",
    textDecoration: "underline",
    textDecorationStyle: "dotted",
  },
};