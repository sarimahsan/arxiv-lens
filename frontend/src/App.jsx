import { Component, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D from "react-force-graph-2d";
import "./App.css";

const API = "http://localhost:8000";

function toText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return typeof value === "string" ? value : String(value);
}

function toStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toText(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeAnalyzeResponse(data, requestedId) {
  const safe = data && typeof data === "object" ? data : {};
  const safeSummary = safe.summary && typeof safe.summary === "object" ? safe.summary : {};
  const safeGraph = safe.graph && typeof safe.graph === "object" ? safe.graph : {};

  const nodes = Array.isArray(safeGraph.nodes)
    ? safeGraph.nodes
        .filter((node) => node && typeof node === "object" && node.id !== undefined && node.id !== null)
        .map((node) => ({
          id: toText(node.id),
          title: toText(node.title || node.id),
          type: node.type === "main" ? "main" : "reference"
        }))
    : [];

  const nodeIds = new Set(nodes.map((node) => node.id));
  const links = Array.isArray(safeGraph.links)
    ? safeGraph.links
        .filter((link) => link && typeof link === "object")
        .map((link) => ({ source: toText(link.source), target: toText(link.target) }))
        .filter((link) => nodeIds.has(link.source) && nodeIds.has(link.target))
    : [];

  const sections = Array.isArray(safeSummary.sections)
    ? safeSummary.sections.map((section) => toText(section)).filter(Boolean)
    : typeof safeSummary.sections === "string"
      ? [safeSummary.sections]
      : [];

  return {
    arxiv_id: toText(safe.arxiv_id || requestedId),
    title: toText(safe.title, "Untitled paper"),
    authors: toStringArray(safe.authors),
    published: toText(safe.published),
    abstract: toText(safe.abstract, "Abstract unavailable."),
    summary: {
      full_summary: toText(safeSummary.full_summary),
      sections
    },
    graph: {
      nodes,
      links
    }
  };
}

class GraphErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <div className="graph-empty">Graph failed to render. Try analyzing again.</div>;
    }
    return this.props.children;
  }
}

async function analyzePaper(arxivId) {
  const res = await fetch(`${API}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arxiv_id: arxivId })
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || "Analysis failed");
  }

  return res.json();
}

async function chatWithPaper(arxivId, question) {
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ arxiv_id: arxivId, question })
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.detail || "Chat failed");
  }

  return res.json();
}

function CitationGraph({ graph, onNodeSelect }) {
  const fgRef = useRef(null);

  const graphData = useMemo(() => {
    const nodes = (graph?.nodes || []).map((node) => ({
      ...node,
      val: node.type === "main" ? 10 : 5
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = (graph?.links || []).filter((l) => nodeIds.has(l.source) && nodeIds.has(l.target));

    return { nodes, links };
  }, [graph]);

  useEffect(() => {
    if (!fgRef.current || !graphData.nodes.length) return;

    const timer = setTimeout(() => {
      try {
        fgRef.current.zoomToFit(450, 42);
      } catch {
        // Ignore initial render race condition.
      }
    }, 320);

    return () => clearTimeout(timer);
  }, [graphData]);

  if (!graphData.nodes.length) {
    return <div className="graph-empty">No citation nodes available for this paper.</div>;
  }

  return (
    <GraphErrorBoundary>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="rgba(255,255,255,0)"
        cooldownTicks={100}
        nodeRelSize={5}
        d3VelocityDecay={0.24}
        d3AlphaDecay={0.024}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={1.7}
        linkDirectionalParticleSpeed={0.005}
        linkWidth={(link) => (link.source?.type === "main" || link.target?.type === "main" ? 2.4 : 1.4)}
        linkColor={() => "rgba(217, 92, 92, 0.46)"}
        onNodeClick={(node) => onNodeSelect?.(node)}
        onNodeDragEnd={(node) => {
          node.fx = node.x;
          node.fy = node.y;
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const x = Number.isFinite(node?.x) ? node.x : 0;
          const y = Number.isFinite(node?.y) ? node.y : 0;
          const safeScale = Number.isFinite(globalScale) && globalScale > 0 ? globalScale : 1;

          if (!Number.isFinite(x) || !Number.isFinite(y)) return;

          const isMain = node.type === "main";
          const baseRadius = isMain ? 10 : 7;
          const radius = Math.min(24, Math.max(3, baseRadius / Math.sqrt(safeScale)));
          const fontSize = Math.max(10 / safeScale, 4);
          const label = toText(node.title || node.id || "paper");

          const gradient = ctx.createRadialGradient(
            x - radius * 0.25,
            y - radius * 0.25,
            0,
            x,
            y,
            radius * 1.8
          );

          if (isMain) {
            gradient.addColorStop(0, "#fdf4f4");
            gradient.addColorStop(0.5, "#ef9b9b");
            gradient.addColorStop(1, "#c24f4f");
          } else {
            gradient.addColorStop(0, "#fff6f4");
            gradient.addColorStop(0.6, "#f6b1a5");
            gradient.addColorStop(1, "#dc7b6d");
          }

          ctx.beginPath();
          ctx.arc(x, y, radius * 1.25, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(218, 85, 85, 0.18)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(x - radius * 0.2, y - radius * 0.2, radius * 0.28, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.fill();

          ctx.font = `${isMain ? 700 : 500} ${fontSize}px Manrope, sans-serif`;
          ctx.fillStyle = "#3b1d1f";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          const cleanLabel = label.length > 28 ? `${label.slice(0, 28)}...` : label;
          ctx.fillText(cleanLabel, x + radius + 4, y);
        }}
      />
    </GraphErrorBoundary>
  );
}

function StatCard({ value, label }) {
  return (
    <div className="stat-card glass">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

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
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  async function handleAnalyze() {
    const id = arxivId.trim();
    if (!id) return;

    setLoading(true);
    setError("");
    setSelectedNode(null);

    try {
      const data = await analyzePaper(id);
      setPaper(normalizeAnalyzeResponse(data, id));
      setActiveTab("summary");
    } catch (err) {
      setError(err.message || "Failed to analyze paper");
    } finally {
      setLoading(false);
    }
  }

  async function handleChat() {
    if (!paper || !question.trim()) return;

    const q = question.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setChatLoading(true);

    try {
      const data = await chatWithPaper(paper.arxiv_id || arxivId, q);
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai", text: `Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  }

  const referenceCount = paper?.graph?.nodes?.filter((n) => n.type !== "main").length || 0;
  const sectionCount = paper?.summary?.sections?.length || 0;

  return (
    <div className="app-shell">
      <div className="bg-wash" />
      <div className="bg-grid" />

      <header className="top-nav glass">
        <div className="brand-wrap">
          <div className="brand-mark">AL</div>
          <div>
            <p className="brand-title">ArXiv Lens Studio</p>
            <p className="brand-subtitle">Research Intelligence Workspace</p>
          </div>
        </div>


      </header>

      <main className="page-wrap">
        <section className="hero glass">
          <div>
            <h1>Publication Analysis Interface</h1>
            <p>
              Parse arXiv papers into concise insights, interrogate the content with AI, and explore citation topology in an interactive visual workspace.
            </p>
          </div>

          <div className="search-panel">
            <input
              value={arxivId}
              onChange={(e) => setArxivId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Enter arXiv ID, for example: 2310.06825"
            />
            <button onClick={handleAnalyze} disabled={loading}>
              {loading ? "Analyzing..." : "Analyze Paper"}
            </button>
          </div>

          <div className="quick-ids">
            {["2310.06825", "2005.11401", "1706.03762"].map((id) => (
              <button key={id} onClick={() => setArxivId(id)}>
                {id}
              </button>
            ))}
          </div>

          {error && <div className="error-banner">{error}</div>}
        </section>

        {paper && (
          <section className="dashboard-grid">
            <div className="left-column">
              <div className="paper-meta glass">
                <p className="eyebrow">Active Paper</p>
                <h2>{toText(paper.title, "Untitled paper")}</h2>
                <p className="authors">{paper.authors?.length ? paper.authors.join(", ") : "Authors unavailable"}</p>

                <div className="meta-foot">
                  <span>{toText(paper.published).slice(0, 10) || "Unknown date"}</span>
                  <span>{paper.arxiv_id || arxivId}</span>
                </div>
              </div>

              <div className="stats-row">
                <StatCard value={referenceCount} label="References" />
                <StatCard value={sectionCount} label="Summary Points" />
                <StatCard value={messages.length} label="Chat Turns" />
              </div>

              <div className="content-card glass">
                <div className="tab-row">
                  <button className={activeTab === "summary" ? "tab active" : "tab"} onClick={() => setActiveTab("summary")}>
                    Summary
                  </button>
                  <button className={activeTab === "chat" ? "tab active" : "tab"} onClick={() => setActiveTab("chat")}>
                    AI Assistant
                  </button>
                </div>

                {activeTab === "summary" && (
                  <div className="summary-block">
                    <h3>Abstract</h3>
                    <p>{toText(paper.abstract, "Abstract unavailable.")}</p>

                    <h3>Key Insights</h3>
                    {(paper.summary?.sections || []).map((section, index) => (
                      <div className="summary-item" key={index}>
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <p>{section}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "chat" && (
                  <div className="chat-block">
                    <div className="chat-messages">
                      {messages.length === 0 && <p className="chat-empty">Ask focused questions about methods, datasets, results, or limitations.</p>}

                      {messages.map((message, idx) => (
                        <div className={message.role === "user" ? "chat-row user" : "chat-row ai"} key={idx}>
                          <div className="bubble">{message.text}</div>
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="chat-row ai">
                          <div className="bubble">Generating response...</div>
                        </div>
                      )}

                      <div ref={chatEndRef} />
                    </div>

                    <div className="chat-input-row">
                      <input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleChat()}
                        placeholder="Ask about contribution, novelty, experimental setup..."
                      />
                      <button onClick={handleChat} disabled={chatLoading}>
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="right-column">
              <div className="graph-card glass">
                <div className="graph-head">
                  <div>
                    <p className="eyebrow">Knowledge Topology</p>
                    <h3>Citation Graph</h3>
                  </div>
                  <p className="graph-note">Drag nodes to inspect relations</p>
                </div>

                <div className="graph-wrap">
                  <CitationGraph graph={paper.graph} onNodeSelect={setSelectedNode} />
                </div>

                {selectedNode && (
                  <div className="selected-node">
                    <p>{selectedNode.title || selectedNode.id}</p>
                    <span>{selectedNode.type}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {!paper && !loading && (
          <section className="empty-state glass">
            <h2>Ready for your first paper</h2>
            <p>Start by entering an arXiv identifier. The interface will generate summaries, citation context, and a Q&A workspace.</p>
          </section>
        )}
      </main>
    </div>
  );
}
